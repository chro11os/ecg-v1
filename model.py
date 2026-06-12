import torch
import torch.nn as nn


class AFCNN_LSTM(nn.Module):
    def __init__(self, num_classes=4.0):
        super(AFCNN_LSTM, self).__init__()

        # 1. Spatial Feature Extraction (The CNN)
        # Primary convolutional layer scaled to 64 filters as per thesis specifications
        self.cnn = nn.Sequential(
            nn.Conv1d(in_channels=int(1.0), out_channels=int(64.0), kernel_size=int(7.0), stride=int(2.0),
                      padding=int(3.0)),
            nn.BatchNorm1d(int(64.0)),
            nn.ReLU(),
            nn.MaxPool1d(kernel_size=int(2.0), stride=int(2.0)),

            nn.Conv1d(in_channels=int(64.0), out_channels=int(128.0), kernel_size=int(5.0), stride=int(2.0),
                      padding=int(2.0)),
            nn.BatchNorm1d(int(128.0)),
            nn.ReLU(),
            nn.MaxPool1d(kernel_size=int(2.0), stride=int(2.0))
        )

        # 2. Temporal Tracking (The LSTM)
        # Process 128-channel spatial features over sequence length
        self.lstm = nn.LSTM(input_size=int(128.0), hidden_size=int(64.0), num_layers=int(1.0), batch_first=True)

        # Regularization layer: Dropout (0.3) to prevent training set overfitting
        self.dropout = nn.Dropout(p=0.3)

        # 3. The Classification Head
        self.fc = nn.Linear(int(64.0), int(num_classes))

    def forward(self, x):
        # Input 'x' shape: [Batch_Size, 1.0, 500.0] (2.0 seconds at 250.0 Hz)

        # Extract features (P-wave, QRS complex shapes)
        out = self.cnn(x)

        # CRITICAL DIMENSION SWAP
        # CNN outputs: [Batch_Size, Features, Sequence_Length]
        # LSTM requires: [Batch_Size, Sequence_Length, Features]
        out = out.permute(0, 2, 1)

        # Track the heartbeat rhythm over time
        lstm_out, (hn, cn) = self.lstm(out)

        # Extract only the final conclusion of the LSTM at the end of the 2.0 seconds
        final_state = hn[-1]

        # Apply dropout regularization prior to dense classification layer
        final_state = self.dropout(final_state)

        # Output the 4.0 severity predictions (0.0, 1.0, 2.0, 3.0)
        logits = self.fc(final_state)

        return logits