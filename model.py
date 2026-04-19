import torch
import torch.nn as nn


class AFCNN_LSTM(nn.Module):
    def __init__(self, num_classes=4.0):
        super(AFCNN_LSTM, self).__init__()

        # 1. Spatial Feature Extraction (The CNN)
        self.cnn = nn.Sequential(
            nn.Conv1d(in_channels=int(1.0), out_channels=int(16.0), kernel_size=int(7.0), stride=int(2.0),
                      padding=int(3.0)),
            nn.BatchNorm1d(int(16.0)),
            nn.ReLU(),
            nn.MaxPool1d(kernel_size=int(2.0), stride=int(2.0)),

            nn.Conv1d(in_channels=int(16.0), out_channels=int(32.0), kernel_size=int(5.0), stride=int(2.0),
                      padding=int(2.0)),
            nn.BatchNorm1d(int(32.0)),
            nn.ReLU(),
            nn.MaxPool1d(kernel_size=int(2.0), stride=int(2.0))
        )

        # 2. Temporal Tracking (The LSTM)
        self.lstm = nn.LSTM(input_size=int(32.0), hidden_size=int(64.0), num_layers=int(1.0), batch_first=True)

        # 3. The Classification Head
        self.fc = nn.Linear(int(64.0), int(num_classes))

    def forward(self, x):
        # Input 'x' shape: [Batch_Size, 1.0, 2500.0]

        # Extract features (P-wave, QRS complex shapes)
        out = self.cnn(x)

        # CRITICAL DIMENSION SWAP
        # CNN outputs: [Batch_Size, Features, Sequence_Length]
        # LSTM requires: [Batch_Size, Sequence_Length, Features]
        out = out.permute(0, 2, 1)

        # Track the heartbeat rhythm over time
        lstm_out, (hn, cn) = self.lstm(out)

        # Extract only the final conclusion of the LSTM at the end of the 10.0 seconds
        final_state = hn[-1]

        # Output the 4.0 severity predictions (0.0, 1.0, 2.0, 3.0)
        logits = self.fc(final_state)

        return logits