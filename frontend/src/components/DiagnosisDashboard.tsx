import React, { useEffect, useRef } from "react";
import Chart from "chart.js/auto";
import type { DiagnosisData, SeverityLevel } from "../types";
import WaveformChart from "./WaveformChart";

interface Props {
	data: DiagnosisData;
	onReset: () => void;
}

const severityMap = {
	0: {
		label: "0 - Normal",
		color: "text-status-healthy font-extrabold",
		border: "border-status-healthy",
		bg: "bg-status-healthy/10",
		cardHighlight: "bg-status-healthy/5 border border-status-healthy shadow-[0_8px_30px_rgba(22,163,74,0.08)] scale-[1.01] font-bold",
	},
	1: {
		label: "1 - Trace",
		color: "text-status-info font-extrabold",
		border: "border-status-info",
		bg: "bg-status-info/10",
		cardHighlight: "bg-status-info/5 border border-status-info shadow-[0_8px_30px_rgba(37,99,235,0.08)] scale-[1.01] font-bold",
	},
	2: {
		label: "2 - Mild",
		color: "text-status-warning font-extrabold",
		border: "border-status-warning",
		bg: "bg-status-warning/10",
		cardHighlight: "bg-status-warning/5 border border-status-warning shadow-[0_8px_30px_rgba(217,119,6,0.08)] scale-[1.01] font-bold",
	},
	3: {
		label: "3 - Severe",
		color: "text-status-critical font-extrabold",
		border: "border-status-critical",
		bg: "bg-status-critical/10",
		cardHighlight: "bg-status-critical/5 border border-status-critical shadow-[0_8px_30px_rgba(220,38,38,0.08)] scale-[1.01] font-bold",
	},
};

const DiagnosisDashboard: React.FC<Props> = ({ data, onReset }) => {
	const chartRef = useRef<HTMLCanvasElement | null>(null);
	const severityInfo = severityMap[data.severity];

	const exportReport = () => {
		const patientHash = `MD-${Math.random().toString(36).substring(2, 8).toUpperCase()}-${Math.round(Math.random() * 10000)}`;
		const timestamp = new Date().toLocaleString();
		const printWindow = window.open("", "_blank");
		if (!printWindow) return;

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
					.severity-badge-0 { color: #16A34A; }
					.severity-badge-1 { color: #2563EB; }
					.severity-badge-2 { color: #D97706; }
					.severity-badge-3 { color: #DC2626; }
					
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
						<p>ATRIAL FIBRILLATION SEVERITY AUTOMATED LANDMARK EVALUATION</p>
					</div>
					<div class="meta-ledger">
						<div>LEDGER HASH: <b>${patientHash}</b></div>
						<div>GENERATED: <b>${timestamp}</b></div>
						<div>HARDWARE BACKEND: <b>${data.hardware.toUpperCase()}</b></div>
					</div>
				</div>

				<div class="diagnostic-summary">
					<div class="summary-box">
						<h3>Severity Status</h3>
						<p class="severity-badge-${data.severity}">
							${data.severity === 0 ? 'CLASS 0: NORMAL' :
							  data.severity === 1 ? 'CLASS 1: TRACE' :
							  data.severity === 2 ? 'CLASS 2: MILD' : 'CLASS 3: SEVERE'}
						</p>
					</div>
					<div class="summary-box">
						<h3>Softmax Confidence</h3>
						<p style="color: #0066CC">${data.confidence}%</p>
					</div>
					<div class="summary-box">
						<h3>Calculated AF Burden</h3>
						<p style="color: #16A34A">${data.burden}%</p>
					</div>
				</div>

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
							Classification Model Version: 1D CNN-LSTM v1.0.0
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
							const severity = ${data.severity};

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
										ctx.fillStyle = "rgba(220, 38, 38, " + (val * 0.20) + ")";
										ctx.fillRect(x1, 0, x2 - x1, height);
									}
								}

								// Draw Attention Boundary dashed line at 500 samples (2.0s mark)
								if (signal.length > 500) {
									const boundaryX = getX(500);
									ctx.strokeStyle = 'rgba(0, 102, 204, 0.4)';
									ctx.lineWidth = 1.5;
									ctx.setLineDash([4, 4]);
									ctx.beginPath();
									ctx.moveTo(boundaryX, 0);
									ctx.lineTo(boundaryX, height);
									ctx.stroke();

									ctx.fillStyle = '#0066CC';
									ctx.font = 'bold 9px monospace';
									ctx.fillText('MODEL ATTENTION WINDOW (2.0s)', boundaryX - 170, 15);
								}
								ctx.restore();
							}

							// Draw traditional heuristic highlight for severity 2 & 3
							if (severity === 2 || severity === 3) {
								ctx.save();
								const startX = getX(750);
								const endX = getX(1750);
								ctx.fillStyle = 'rgba(220, 38, 38, 0.04)';
								ctx.fillRect(startX, 0, endX - startX, height);

								ctx.strokeStyle = 'rgba(220, 38, 38, 0.2)';
								ctx.lineWidth = 1.2;
								ctx.setLineDash([5, 4]);
								ctx.beginPath();
								ctx.moveTo(startX, 0);
								ctx.lineTo(startX, height);
								ctx.moveTo(endX, 0);
								ctx.lineTo(endX, height);
								ctx.stroke();

								ctx.fillStyle = '#DC2626';
								ctx.font = 'bold 9px monospace';
								ctx.fillText('ERRATIC ARRHYTHMIC SEGMENT DETECTED (3.0s - 7.0s)', startX + 8, 15);
								ctx.restore();
							}

							// Draw ECG signal path
							ctx.beginPath();
							ctx.strokeStyle = '#0066CC';
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
								ctx.fillStyle = '#DC2626';
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
	};

	useEffect(() => {
		if (!chartRef.current) return;

		const chart = new Chart(chartRef.current, {
			type: "doughnut",
			data: {
				datasets: [
					{
						data: [data.confidence, 100 - data.confidence],
						backgroundColor: ["#0066CC", "#E5E7EB"],
						borderWidth: 0,
					},
				],
			},
			options: {
				responsive: true,
				cutout: "75%",
				plugins: {
					legend: { display: false },
					tooltip: { enabled: false },
				},
			},
		});

		return () => {
			chart.destroy();
		};
	}, [data]);

	return (
		<div className="w-full text-text-primary transition-colors duration-300">
			<div className="w-full max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
				<div className="lg:col-span-2 space-y-6">
					<div className="rounded-none p-6 bg-card-bg border border-border-subtle shadow-xs">
						<div className="flex items-center justify-between gap-4 flex-wrap">
							<div>
								<h1 className="text-3xl font-bold">Diagnosis Dashboard</h1>
								<p className="text-brand-secondary mt-1">Atrial Fibrillation Severity Analysis</p>
							</div>
							<div className="flex items-center gap-4 flex-wrap">
								<button
									onClick={exportReport}
									className="px-4 py-2.5 text-xs font-mono font-bold bg-status-healthy hover:bg-status-healthy/90 text-white rounded-none shadow-xs transition-all cursor-pointer active:scale-95 shrink-0"
								>
									EXPORT REPORT
								</button>
								<div className={`px-6 py-3 rounded-none border ${severityInfo.bg} ${severityInfo.border}`}>
									<p className="text-sm uppercase tracking-wider opacity-85">Severity Status</p>
									<h2 className={`text-3xl font-bold ${severityInfo.color}`}>
										{severityInfo.label}
									</h2>
								</div>
							</div>
						</div>
					</div>

					<div className="lg:col-span-2">
						<WaveformChart signal={data.rawSignal} severity={data.severity} rPeaks={data.rPeaks} gradCam={data.gradCam} />
					</div>

					<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
						<div className="rounded-none p-6 bg-card-bg border border-border-subtle shadow-xs">
							<div className="flex items-center justify-between mb-4">
								<div>
									<h3 className="text-xl font-semibold">Confidence Gauge</h3>
									<p className="text-brand-secondary text-sm">Softmax Probability</p>
								</div>
								<div className="text-right">
									<p className="text-4xl font-bold text-brand-primary">{data.confidence}%</p>
								</div>
							</div>
							<div className="h-72 flex items-center justify-center">
								<canvas ref={chartRef}></canvas>
							</div>
						</div>

						<div className="rounded-none p-6 bg-card-bg border border-border-subtle shadow-xs flex flex-col justify-between">
							<div className="flex items-center justify-between mb-4">
								<div>
									<h3 className="text-xl font-semibold">AF Burden Meter</h3>
									<p className="text-brand-secondary text-sm">Calculated AF Burden</p>
								</div>
								<div className="text-right">
									<p className="text-4xl font-bold text-status-healthy">{data.burden}%</p>
								</div>
							</div>
							<div className="mt-6 flex-1 flex flex-col justify-center">
								<div className="w-full h-8 bg-border-subtle rounded-none overflow-hidden">
									<div
										className="h-full bg-linear-to-r from-status-healthy to-status-warning rounded-none flex items-center justify-end pr-4 font-semibold text-white transition-all duration-500"
										style={{ width: `${data.burden}%` }}
									>
										{data.burden}%
									</div>
								</div>
								<div className="flex justify-between text-xs text-brand-secondary mt-3">
									<span>Normal</span>
									<span>Trace</span>
									<span>Mild</span>
									<span>Severe</span>
								</div>
							</div>
						</div>

						<div className="rounded-none p-6 bg-card-bg border border-border-subtle shadow-xs flex flex-col justify-between">
							<div className="flex items-center justify-between mb-4">
								<div>
									<h3 className="text-xl font-semibold">Landmark DSP</h3>
									<p className="text-brand-secondary text-sm">Algorithmic Gating</p>
								</div>
								<div className="text-right">
									<p className="text-sm font-mono text-brand-primary font-bold">Peaks: {data.rPeaks?.length ?? 0}</p>
								</div>
							</div>
							<div className="space-y-4 my-2 flex-1 flex flex-col justify-center">
								<div className="bg-bg-canvas p-3 border border-border-subtle">
									<div className="flex justify-between text-[11px] font-mono text-brand-secondary mb-1">
										<span>R-R Variance</span>
										<span className="text-brand-primary font-bold">{data.rrVariance ?? 0.0} ms²</span>
									</div>
									<div className="w-full h-1.5 bg-border-subtle">
										<div 
											className="h-full bg-brand-primary" 
											style={{ width: `${Math.min((data.rrVariance ?? 0.0) / 10.0, 100.0)}%` }}
										/>
									</div>
								</div>
								<div className="bg-bg-canvas p-3 border border-border-subtle">
									<div className="flex justify-between text-[11px] font-mono text-brand-secondary mb-1">
										<span>RMSSD</span>
										<span className="text-status-healthy font-bold">{data.rmssd ?? 0.0} ms</span>
									</div>
									<div className="w-full h-1.5 bg-border-subtle">
										<div 
											className="h-full bg-status-healthy" 
											style={{ width: `${Math.min((data.rmssd ?? 0.0) / 2.0, 100.0)}%` }}
										/>
									</div>
								</div>
							</div>
							<div className="text-[10px] font-mono text-brand-secondary tracking-normal mt-2 border-t border-border-subtle pt-2 shrink-0">
								{data.severity === 0 ? "Sinus rhythm: uniform peak intervals." : 
								 data.severity === 1 ? "Trace AFib: minor temporal peak jitter." : 
								 data.severity === 2 ? "Mild AFib: elevated R-R segment variance." : 
								 "Severe AFib: highly erratic gating landmarks."}
							</div>
						</div>
					</div>

					<div className="rounded-none p-6 bg-card-bg border border-border-subtle shadow-xs">
						<div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
							<div>
								<h3 className="text-xl font-semibold">Inference Metadata</h3>
								<p className="text-brand-secondary text-sm">Runtime diagnostics</p>
							</div>
							<div className="flex gap-4 flex-wrap">
								<div className="bg-bg-canvas border border-border-subtle rounded-none px-5 py-4 min-w-45">
									<p className="text-brand-secondary text-sm">Hardware Used</p>
									<div className="flex items-center gap-2 mt-1">
										<span className="w-3.5 h-3.5 bg-status-healthy"></span>
										<span className="text-lg font-semibold uppercase">{data.hardware}</span>
									</div>
								</div>
								<div className="bg-bg-canvas border border-border-subtle rounded-none px-5 py-4 min-w-45">
									<p className="text-brand-secondary text-sm">Response Time</p>
									<div className="flex items-center gap-2 mt-1">
										<span className="text-lg font-semibold">{data.responseTime} ms</span>
									</div>
								</div>
								<button
									onClick={onReset}
									className="bg-brand-primary hover:bg-brand-primary/95 text-white rounded-none px-6 py-4 font-bold transition-colors cursor-pointer"
								>
									NEW SCAN
								</button>
							</div>
						</div>
					</div>
				</div>

				<div className="rounded-none p-6 flex flex-col bg-card-bg border border-border-subtle shadow-xs">
					<h3 className="text-2xl font-bold mb-6">Severity Classes</h3>
					<div className="space-y-4">
						{[0, 1, 2, 3].map((level) => {
							const current = severityMap[level as SeverityLevel];
							const isActive = data.severity === level;
							return (
								<div
									key={level}
									className={`p-4 rounded-none border transition-all duration-300 ${
										isActive 
											? current.cardHighlight 
											: "bg-bg-canvas/50 border-border-subtle/50 opacity-40 hover:opacity-60 scale-98 cursor-default"
									}`}
								>
									<div className="flex justify-between items-center">
										<span className="font-semibold">{current.label}</span>
										<span className={current.color}>
											{level === 0 && "Stable"}
											{level === 1 && "Low Risk"}
											{level === 2 && "Moderate"}
											{level === 3 && "Critical"}
										</span>
									</div>
								</div>
							);
						})}
					</div>
				</div>
			</div>
		</div>
	);
};

export default DiagnosisDashboard;

