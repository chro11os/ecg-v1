import type { DiagnosisData } from "../types";
import { TIERS } from "../tiers";
import { getCHA2DS2VAScBreakdown, getStrokeRiskCategory } from "./strokeRisk";

// Opens a printable report for one scan in a new window and triggers the print dialog
export function exportReport(data: DiagnosisData, activePatient?: any) {
	const patientHash = data.patientId || `MD-${Math.random().toString(36).substring(2, 8).toUpperCase()}-${Math.round(Math.random() * 10000)}`;
	const timestamp = new Date().toLocaleString();
	const printWindow = window.open("", "_blank");
	if (!printWindow) return;

	const riskInfo = data.strokeRiskScore !== undefined ? getStrokeRiskCategory(data.strokeRiskScore) : null;

	const htmlContent = `
		<!DOCTYPE html>
		<html>
		<head>
			<title>Clinical ECG Diagnostic Report - ${patientHash}</title>
			<style>
				body {
					font-family: 'Helvetica Neue', Arial, sans-serif;
					color: #121417;
					background: #F8F9FA;
					padding: 40px;
					margin: 0;
				}
				.header {
					display: flex;
					justify-content: space-between;
					border-bottom: 2px solid #121417;
					padding-bottom: 20px;
					margin-bottom: 30px;
				}
				.title-section h1 {
					margin: 0 0 5px 0;
					font-size: 24px;
					font-weight: 800;
					letter-spacing: 1px;
				}
				.title-section p {
					margin: 0;
					font-family: monospace;
					color: #4A5568;
					font-size: 11px;
				}
				.meta-ledger {
					text-align: right;
					font-family: monospace;
					font-size: 11px;
					color: #4A5568;
				}
				.diagnostic-summary {
					display: flex;
					gap: 20px;
					margin-bottom: 30px;
				}
				.summary-box {
					flex: 1;
					background: #FFFFFF;
					border: 1px solid #E5E7EB;
					padding: 20px;
				}
				.summary-box h3 {
					margin: 0 0 10px 0;
					font-size: 12px;
					color: #4A5568;
					text-transform: uppercase;
					letter-spacing: 1.5px;
				}
				.summary-box p {
					margin: 0;
					font-size: 24px;
					font-weight: 700;
				}
				.burden-badge-0 { color: #5B5870; }
				.burden-badge-1 { color: #B5577A; }
				.burden-badge-2 { color: #C2306A; }
				.burden-badge-3 { color: #8C0F3A; }
				
				.signal-strip-container {
					background: #FFFFFF;
					border: 1px solid #E5E7EB;
					padding: 20px;
					margin-bottom: 40px;
				}
				.signal-strip-container h3 {
					margin: 0 0 15px 0;
					font-size: 12px;
					color: #4A5568;
					text-transform: uppercase;
					letter-spacing: 1.5px;
				}
				
				.landmark-telemetry {
					display: flex;
					gap: 20px;
					margin-bottom: 50px;
				}
				.telemetry-item {
					flex: 1;
					background: #FFFFFF;
					border: 1px solid #E5E7EB;
					padding: 15px;
					font-family: monospace;
				}
				.telemetry-item div {
					display: flex;
					justify-content: space-between;
					font-size: 12px;
					margin-bottom: 5px;
				}
				.telemetry-item .value {
					font-weight: bold;
					color: #121417;
				}

				.sign-off-zone {
					margin-top: 80px;
					display: flex;
					justify-content: space-between;
					align-items: flex-end;
					border-top: 1px dashed #E5E7EB;
					padding-top: 30px;
				}
				.signature-box {
					width: 250px;
					border-bottom: 1px solid #121417;
					height: 50px;
				}
				.signature-label {
					font-family: monospace;
					font-size: 11px;
					color: #4A5568;
					margin-top: 5px;
				}

				@media print {
					body { padding: 20px; }
					button { display: none; }
				}
			</style>
		</head>
		<body>
			<div class="header">
				<div class="title-section">
					<h1>CLINICAL ECG DIAGNOSTIC REPORT</h1>
					<p>ATRIAL FIBRILLATION TEMPORAL BURDEN AUTOMATED LANDMARK EVALUATION</p>
				</div>
				<div class="meta-ledger">
					<div>PATIENT ID: <b>${patientHash}</b></div>
					<div>GENERATED: <b>${timestamp}</b></div>
					<div>HARDWARE BACKEND: <b>${data.hardware.toUpperCase()}</b></div>
				</div>
			</div>

			<div class="diagnostic-summary">
				<div class="summary-box">
					<h3>Burden tier</h3>
					<p class="burden-badge-${data.burdenTier}">
						${TIERS[data.burdenTier].name} (${TIERS[data.burdenTier].detail})
					</p>
				</div>
				<div class="summary-box">
					<h3>Model confidence</h3>
					<p>${data.confidence}%</p>
				</div>
				<div class="summary-box">
					<h3>AFib burden</h3>
					<p>${data.burden == null ? 'Not measured' : `${data.burden}%`}</p>
				</div>
			</div>

			${riskInfo ? `
			<div class="diagnostic-summary" style="display: block; margin-bottom: 30px;">
				<div style="display: flex; gap: 20px;">
					<div class="summary-box" style="flex: 1;">
						<h3>CHA₂DS₂-VASc Stroke Risk</h3>
						<p style="font-size: 20px; margin-bottom: 5px;">Score: <b>${data.strokeRiskScore}</b> (${riskInfo.label})</p>
						<p style="font-size: 11px; color: #4A5568; margin-top: 5px; line-height: 1.4;">${riskInfo.rec}</p>
						
						${activePatient ? `
						<div style="margin-top: 15px; border-top: 1px dashed #E5E7EB; padding-top: 15px;">
							<h4 style="margin: 0 0 8px 0; font-size: 10px; text-transform: uppercase; color: #4A5568; letter-spacing: 1px;">Clinical Risk Factor Breakdown</h4>
							<table style="width: 100%; border-collapse: collapse; font-family: monospace; font-size: 10px;">
								<thead>
									<tr style="border-bottom: 1px solid #E5E7EB; text-align: left; color: #4A5568;">
										<th style="padding: 4px 0; font-weight: normal;">Criteria</th>
										<th style="padding: 4px 0; text-align: right; font-weight: normal;">Points</th>
									</tr>
								</thead>
								<tbody>
									${getCHA2DS2VAScBreakdown(activePatient).map(item => `
										<tr style="border-bottom: 1px solid #F3F4F6; ${item.active ? 'font-weight: bold; color: #1E1B2E;' : 'color: #9CA3AF;'}">
											<td style="padding: 4px 0;">${item.active ? '● ' : '○ '}${item.criteria}</td>
											<td style="padding: 4px 0; text-align: right;">${item.active ? `+${item.pts}` : '0'}</td>
										</tr>
									`).join('')}
								</tbody>
							</table>
						</div>
						` : ''}
					</div>
					<div class="summary-box" style="flex: 1; display: flex; flex-direction: column; justify-content: space-between;">
						<div>
							<h3>Scans with AFib</h3>
							<p style="font-size: 20px; color: #B3164B; margin-bottom: 5px;"><b>${data.cumulativeAFibBurden ?? 0.0}%</b></p>
						</div>
						<div style="font-size: 10px; color: #4A5568; font-family: monospace; margin-top: 15px; border-top: 1px dashed #E5E7EB; padding-top: 10px;">
							Share of this patient's scans in which AFib was detected.
						</div>
					</div>
				</div>
			</div>
			` : ''}

			<div class="signal-strip-container">
				<h3>10-Second Waveform Strip (R-Peaks Annotated)</h3>
				<p style="font-size: 13px; color: #4A5568; margin: -5px 0 15px 0; font-family: monospace;">
					ECG Lead I: annotated with ${data.rPeaks?.length ?? 0} isolated R-peak landmarks.
				</p>
				<div style="border: 1px solid #E5E7EB; background: #FFFFFF; padding: 10px;">
					<canvas id="waveform-canvas" width="1000" height="200" style="width: 100%; height: 200px; display: block;"></canvas>
				</div>
			</div>

			<div class="landmark-telemetry">
				<div class="telemetry-item">
					<div>
						<span>R-R Interval Variance:</span>
						<span class="value">${data.rrVariance ?? 0.0} ms²</span>
					</div>
					<div>
						<span>RMSSD Interval Gating:</span>
						<span class="value">${data.rmssd ?? 0.0} ms</span>
					</div>
				</div>
				<div class="telemetry-item">
					<div>
						<span>Isolated R-Peaks count:</span>
						<span class="value">${data.rPeaks?.length ?? 0}</span>
					</div>
					<div>
						<span>ECG Window samples:</span>
						<span class="value">2,500 samples (250Hz)</span>
					</div>
				</div>
			</div>

			<div class="sign-off-zone">
				<div>
					<div class="signature-box"></div>
					<div class="signature-label">Attending Cardiologist Signature</div>
				</div>
				<div>
					<div style="font-family: monospace; font-size: 11px; text-align: right; color: #4A5568;">
						Model: 1D CNN-LSTM, per-window AFib detection (v2)
					</div>
				</div>
			</div>

			<script>
				window.onload = function() {
					const canvas = document.getElementById('waveform-canvas');
					if (canvas) {
						const ctx = canvas.getContext('2d');
						const width = canvas.width;
						const height = canvas.height;
						const signal = ${JSON.stringify(data.rawSignal)};
						const rPeaks = ${JSON.stringify(data.rPeaks || [])};
						const gradCam = ${JSON.stringify(data.gradCam || [])};

						// Clear canvas
						ctx.fillStyle = '#FFFFFF';
						ctx.fillRect(0, 0, width, height);

						// Draw grid lines
						ctx.strokeStyle = '#F3F4F6';
						ctx.lineWidth = 1;
						const gridSpacingX = width / (signal.length / 25);
						for (let x = 0; x < width; x += gridSpacingX) {
							ctx.beginPath();
							ctx.moveTo(x, 0);
							ctx.lineTo(x, height);
							ctx.stroke();
						}
						for (let y = 0; y < height; y += 20) {
							ctx.beginPath();
							ctx.moveTo(0, y);
							ctx.lineTo(width, y);
							ctx.stroke();
						}

						// Signal stats for normalization/rendering
						const minVal = Math.min(...signal);
						const maxVal = Math.max(...signal);
						const range = maxVal - minVal || 1.0;

						// Function to map signal index and value to canvas coordinates
						const getX = (idx) => (idx / (signal.length - 1)) * width;
						const getY = (val) => height - 15 - ((val - minVal) / range) * (height - 30);

						// Draw Grad-CAM heatmap overlays if available
						if (gradCam && gradCam.length > 0) {
							const numSamples = Math.min(gradCam.length, signal.length);
							ctx.save();
							for (let i = 0; i < numSamples - 1; i++) {
								const val = gradCam[i];
								if (val > 0.02) {
									const x1 = getX(i);
									const x2 = getX(i + 1);
									ctx.fillStyle = "rgba(30, 27, 46, " + (val * 0.12) + ")";
									ctx.fillRect(x1, 0, x2 - x1, height);
								}
							}

							ctx.restore();
						}

						// Draw ECG signal path
						ctx.beginPath();
						ctx.strokeStyle = '#1E1B2E';
						ctx.lineWidth = 1.5;
						for (let i = 0; i < signal.length; i++) {
							const px = getX(i);
							const py = getY(signal[i]);
							if (i === 0) {
								ctx.moveTo(px, py);
							} else {
								ctx.lineTo(px, py);
							}
						}
						ctx.stroke();

						// Draw R-peaks annotations
						if (rPeaks && rPeaks.length > 0) {
							ctx.fillStyle = '#B3164B';
							rPeaks.forEach(idx => {
								if (idx < signal.length) {
									const px = getX(idx);
									const py = getY(signal[idx]);
									ctx.beginPath();
									ctx.arc(px, py, 4, 0, 2 * Math.PI);
									ctx.fill();
								}
							});
						}
					}

					setTimeout(function() {
						window.print();
					}, 500);
				};
			</script>
		</body>
		</html>
	`;

	printWindow.document.open();
	printWindow.document.write(htmlContent);
	printWindow.document.close();
}
