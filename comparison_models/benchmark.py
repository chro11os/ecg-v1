import os
import sys
import json
import torch
import numpy as np
import matplotlib.pyplot as plt
from torch.utils.data import DataLoader
from sklearn.metrics import accuracy_score, precision_recall_fscore_support, roc_auc_score, confusion_matrix, roc_curve, auc

# Add parent directory to path to locate ml_pipeline and model.py
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from ml_pipeline.dataset import IcentiaECGDataset
from model import AFCNN_LSTM
from models import Standalone1DCNN, StandaloneLSTM, CNN_GRU, CNN_BiLSTM, ECGTransformer

def evaluate_model_metrics(model, test_loader, device):
    model.eval()
    all_preds = []
    all_targets = []
    all_probs = []

    with torch.no_grad():
        for batch_x, batch_y in test_loader:
            batch_x, batch_y = batch_x.to(device), batch_y.to(device)
            outputs = model(batch_x)
            probs = torch.softmax(outputs, dim=1)
            _, preds = torch.max(outputs, dim=1)

            all_preds.extend(preds.cpu().numpy())
            all_targets.extend(batch_y.cpu().numpy())
            all_probs.extend(probs.cpu().numpy())

    all_preds = np.array(all_preds)
    all_targets = np.array(all_targets)
    all_probs = np.array(all_probs)

    # Calculate metrics
    acc = accuracy_score(all_targets, all_preds)
    precision, recall, f1, _ = precision_recall_fscore_support(all_targets, all_preds, average='macro', zero_division=0)

    # Calculate ROC-AUC score safely (handling cases with missing classes)
    try:
        classes_present = np.unique(all_targets)
        if len(classes_present) > 1:
            num_classes = all_probs.shape[1]
            roc_aucs = []
            for c in range(num_classes):
                y_true_c = (all_targets == c).astype(int)
                if len(np.unique(y_true_c)) > 1:
                    score = roc_auc_score(y_true_c, all_probs[:, c])
                    roc_aucs.append(score)
            
            if len(roc_aucs) > 0:
                roc_auc = np.mean(roc_aucs)
            else:
                roc_auc = 0.5
        else:
            roc_auc = 0.5
    except Exception:
        roc_auc = 0.5

    cm = confusion_matrix(all_targets, all_preds)
    return acc, precision, recall, f1, roc_auc, cm, all_targets, all_probs

def main():
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    print(f"--- INITIATING FINAL BENCHMARK EVALUATION ---")
    print(f"Executing on hardware device: {device}")

    # Load splits layout
    layout_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "split_layout.json")
    if not os.path.exists(layout_path):
        print(f"CRITICAL FAILURE: split_layout.json not found. Run prepare_splits.py first.")
        return

    with open(layout_path, "r") as f:
        layout = json.load(f)

    test_files = layout["test"]
    
    # Resolve paths dynamically (handles both relative and old absolute cross-platform paths)
    project_root = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
    resolved_test_files = []
    for f in test_files:
        if os.path.isabs(f):
            if os.path.exists(f + ".dat"):
                resolved_test_files.append(f)
            else:
                # Re-resolve relative to project root if absolute path mismatch
                if "ml_pipeline/physionet_data_aws" in f:
                    rel_sub = f[f.index("ml_pipeline/physionet_data_aws"):]
                    resolved_test_files.append(os.path.join(project_root, rel_sub))
                elif "physionet_data_aws" in f:
                    rel_sub = f[f.index("physionet_data_aws"):]
                    resolved_test_files.append(os.path.join(project_root, "ml_pipeline", rel_sub))
                else:
                    resolved_test_files.append(f)
        else:
            resolved_test_files.append(os.path.abspath(os.path.join(project_root, f)))

    print(f"Testing Split Size: {len(resolved_test_files)} records")

    test_dataset = IcentiaECGDataset(record_paths=resolved_test_files, window_size=500.0)
    test_loader = DataLoader(
        test_dataset, batch_size=64, shuffle=False,
        num_workers=4, pin_memory=True, persistent_workers=True
    )

    # Architectures mapping
    models_to_test = [
        ("Standalone 1D CNN", Standalone1DCNN, "baseline_cnn.pth"),
        ("Standalone LSTM", StandaloneLSTM, "baseline_lstm.pth"),
        ("1D CNN-GRU", CNN_GRU, "hybrid_gru.pth"),
        ("CNN-BiLSTM", CNN_BiLSTM, "hybrid_bilstm.pth"),
        ("Lightweight Transformer", ECGTransformer, "baseline_transformer.pth"),
        ("Thesis 1D CNN-LSTM (Ours)", AFCNN_LSTM, "../afib_cnn_lstm_v1.pt")
    ]

    results = {}

    plt.figure(figsize=(10, 8))

    for name, model_class, weights_file in models_to_test:
        weights_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), weights_file)
        if not os.path.exists(weights_path):
            # Fallback checks for Thesis Model weights
            if name == "Thesis 1D CNN-LSTM (Ours)":
                weights_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../afib_cnn_lstm_v1.pt"))
                if not os.path.exists(weights_path):
                    weights_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../ml_pipeline/afib_cnn_lstm_v1.pt"))

            if not os.path.exists(weights_path):
                print(f"Skipping {name}: Weights file not found.")
                continue

        print(f"Evaluating {name}...")
        model = model_class().to(device)
        model.load_state_dict(torch.load(weights_path, map_location=device))

        acc, prec, rec, f1, roc_auc, cm, targets, probs = evaluate_model_metrics(model, test_loader, device)
        results[name] = {
            "Accuracy": acc,
            "Precision": prec,
            "Recall": rec,
            "F1-Score": f1,
            "ROC-AUC": roc_auc,
            "Confusion Matrix": cm.tolist()
        }

        # Plot ROC curve for Class 3 (Severe AFib) specifically (most critical clinical class)
        try:
            class_idx = 3
            y_true_bin = (targets == class_idx).astype(int)
            y_score_bin = probs[:, class_idx]

            fpr, tpr, _ = roc_curve(y_true_bin, y_score_bin)
            roc_auc_val = auc(fpr, tpr)
            plt.plot(fpr, tpr, label=f'{name} (AUC = {roc_auc_val:.3f})')
        except Exception as e:
            print(f"ROC Curve plotting error for {name}: {e}")

    # Format and save the ROC plot
    plt.plot([0, 1], [0, 1], 'k--', label='Random Guess')
    plt.xlim([0.0, 1.0])
    plt.ylim([0.0, 1.05])
    plt.xlabel('False Positive Rate (1 - Specificity)')
    plt.ylabel('True Positive Rate (Sensitivity)')
    plt.title('ROC Curves for Atrial Fibrillation Severity Detection (Class 3: Severe)')
    plt.legend(loc="lower right")
    plt.grid(True)

    plot_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "roc_curves.png")
    plt.savefig(plot_path)
    print(f"\nROC Curves plot successfully saved to: {plot_path}")

    # Print master benchmarking table
    print("\n" + "="*95)
    print("MASTER ARCHITECTURE BENCHMARKING TABLE")
    print("="*95)
    print(f"{'Model Architecture':<30} | {'Accuracy':<8} | {'Precision':<9} | {'Recall':<8} | {'F1-Score':<8} | {'ROC-AUC':<8}")
    print("-"*95)
    for name, metrics in results.items():
        print(f"{name:<30} | {metrics['Accuracy']*100:6.2f}% | {metrics['Precision']*100:7.2f}% | {metrics['Recall']*100:6.2f}% | {metrics['F1-Score']*100:6.2f}% | {metrics['ROC-AUC']:6.4f}")
    print("="*95 + "\n")

    # Save benchmarking results to JSON
    json_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "benchmark_results.json")
    with open(json_path, "w") as f:
        json.dump(results, f, indent=4)
    print(f"Benchmarking results exported to JSON: {json_path}")

if __name__ == "__main__":
    main()
