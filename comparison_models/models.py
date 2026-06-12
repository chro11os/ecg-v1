import torch
import torch.nn as nn

# 1. Standalone 1D CNN
class Standalone1DCNN(nn.Module):
    def __init__(self, num_classes=4):
        super(Standalone1DCNN, self).__init__()
        self.features = nn.Sequential(
            nn.Conv1d(1, 64, kernel_size=7, stride=2, padding=3),
            nn.BatchNorm1d(64),
            nn.ReLU(),
            nn.MaxPool1d(kernel_size=2, stride=2),

            nn.Conv1d(64, 128, kernel_size=5, stride=2, padding=2),
            nn.BatchNorm1d(128),
            nn.ReLU(),
            nn.MaxPool1d(kernel_size=2, stride=2),

            nn.Conv1d(128, 256, kernel_size=3, stride=2, padding=1),
            nn.BatchNorm1d(256),
            nn.ReLU(),
            nn.MaxPool1d(kernel_size=2, stride=2)
        )
        # Input: [Batch, 256, 8] -> Flatten to 2048
        self.fc = nn.Linear(256 * 8, num_classes)

    def forward(self, x):
        out = self.features(x)
        out = out.view(out.size(0), -1)
        logits = self.fc(out)
        return logits

# 2. Standalone LSTM
class StandaloneLSTM(nn.Module):
    def __init__(self, num_classes=4):
        super(StandaloneLSTM, self).__init__()
        # input_size=1 (1D voltage series), hidden_size=64, num_layers=2
        self.lstm = nn.LSTM(input_size=1, hidden_size=64, num_layers=2, batch_first=True)
        self.fc = nn.Linear(64, num_classes)

    def forward(self, x):
        # Input shape x: [Batch, 1, 500]
        # LSTM requires: [Batch, Sequence_Length, Features] -> [Batch, 500, 1]
        out = x.permute(0, 2, 1)
        lstm_out, (hn, cn) = self.lstm(out)
        # Final hidden state of the last LSTM layer
        final_state = hn[-1]
        logits = self.fc(final_state)
        return logits

# 3. 1D CNN-GRU
class CNN_GRU(nn.Module):
    def __init__(self, num_classes=4):
        super(CNN_GRU, self).__init__()
        self.cnn = nn.Sequential(
            nn.Conv1d(1, 64, kernel_size=7, stride=2, padding=3),
            nn.BatchNorm1d(64),
            nn.ReLU(),
            nn.MaxPool1d(kernel_size=2, stride=2),

            nn.Conv1d(64, 128, kernel_size=5, stride=2, padding=2),
            nn.BatchNorm1d(128),
            nn.ReLU(),
            nn.MaxPool1d(kernel_size=2, stride=2)
        )
        self.gru = nn.GRU(input_size=128, hidden_size=64, num_layers=1, batch_first=True)
        self.fc = nn.Linear(64, num_classes)

    def forward(self, x):
        out = self.cnn(x) # [Batch, 128, 31]
        out = out.permute(0, 2, 1) # [Batch, 31, 128]
        gru_out, hn = self.gru(out)
        final_state = hn[-1]
        logits = self.fc(final_state)
        return logits

# 4. Bidirectional LSTM (BiLSTM)
class CNN_BiLSTM(nn.Module):
    def __init__(self, num_classes=4):
        super(CNN_BiLSTM, self).__init__()
        self.cnn = nn.Sequential(
            nn.Conv1d(1, 64, kernel_size=7, stride=2, padding=3),
            nn.BatchNorm1d(64),
            nn.ReLU(),
            nn.MaxPool1d(kernel_size=2, stride=2),

            nn.Conv1d(64, 128, kernel_size=5, stride=2, padding=2),
            nn.BatchNorm1d(128),
            nn.ReLU(),
            nn.MaxPool1d(kernel_size=2, stride=2)
        )
        self.lstm = nn.LSTM(input_size=128, hidden_size=64, num_layers=1, batch_first=True, bidirectional=True)
        self.fc = nn.Linear(64 * 2, num_classes)

    def forward(self, x):
        out = self.cnn(x) # [Batch, 128, 31]
        out = out.permute(0, 2, 1) # [Batch, 31, 128]
        lstm_out, (hn, cn) = self.lstm(out)
        # Bidirectional hidden state: concatenate forward and backward final states
        # hn has shape [num_layers * num_directions, batch, hidden_size] -> [2, batch, 64]
        forward_state = hn[0]
        backward_state = hn[1]
        final_state = torch.cat((forward_state, backward_state), dim=1) # [batch, 128]
        logits = self.fc(final_state)
        return logits

# 5. Lightweight Transformer
class ECGTransformer(nn.Module):
    def __init__(self, num_classes=4, d_model=64, nhead=4, num_layers=2):
        super(ECGTransformer, self).__init__()
        # Project signal to d_model space: reduce length from 500 to 250 for speed
        self.project = nn.Conv1d(1, d_model, kernel_size=7, stride=2, padding=3)
        self.pos_embedding = nn.Parameter(torch.randn(1, 250, d_model))

        encoder_layer = nn.TransformerEncoderLayer(
            d_model=d_model,
            nhead=nhead,
            dim_feedforward=128,
            batch_first=True,
            dropout=0.1
        )
        self.transformer = nn.TransformerEncoder(encoder_layer, num_layers=num_layers)
        self.fc = nn.Linear(d_model, num_classes)

    def forward(self, x):
        # x shape: [Batch, 1, 500]
        out = self.project(x) # [Batch, d_model, 250]
        out = out.permute(0, 2, 1) # [Batch, 250, d_model]
        out = out + self.pos_embedding

        out = self.transformer(out) # [Batch, 250, d_model]
        # Global Average Pooling over sequence length
        out = torch.mean(out, dim=1) # [Batch, d_model]
        logits = self.fc(out)
        return logits
