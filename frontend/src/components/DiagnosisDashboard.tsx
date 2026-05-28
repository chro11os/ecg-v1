import React, { useEffect, useRef } from "react";
import Chart from "chart.js/auto";
import type { DiagnosisData, SeverityLevel } from "../types";
import WaveformChart from "./WaveformChart";

interface Props {
	data: DiagnosisData;
	darkMode: boolean;
	onReset: () => void;
}

const severityMap = {
	0: {
		label: "0 - Normal",
		color: "text-emerald-500 dark:text-emerald-400 font-extrabold",
		border: "border-emerald-500",
		bg: "bg-emerald-500/10",
		cardHighlight: "bg-emerald-500/5 dark:bg-emerald-950/20 border border-emerald-500 dark:border-emerald-500/50 shadow-[0_8px_30px_rgba(16,185,129,0.08)] scale-[1.01] font-bold",
	},
	1: {
		label: "1 - Trace",
		color: "text-amber-500 dark:text-amber-400 font-extrabold",
		border: "border-amber-500",
		bg: "bg-amber-500/10",
		cardHighlight: "bg-amber-500/5 dark:bg-amber-950/20 border border-amber-500 dark:border-amber-500/50 shadow-[0_8px_30px_rgba(245,158,11,0.08)] scale-[1.01] font-bold",
	},
	2: {
		label: "2 - Mild",
		color: "text-orange-500 dark:text-orange-400 font-extrabold",
		border: "border-orange-500",
		bg: "bg-orange-500/10",
		cardHighlight: "bg-orange-500/5 dark:bg-orange-950/20 border border-orange-500 dark:border-orange-500/50 shadow-[0_8px_30px_rgba(249,115,22,0.08)] scale-[1.01] font-bold",
	},
	3: {
		label: "3 - Severe",
		color: "text-red-500 dark:text-red-400 font-extrabold",
		border: "border-red-500",
		bg: "bg-red-500/10",
		cardHighlight: "bg-red-500/5 dark:bg-red-950/20 border border-red-500 dark:border-red-500/50 shadow-[0_8px_30px_rgba(239,68,68,0.08)] scale-[1.01] font-bold",
	},
};

const DiagnosisDashboard: React.FC<Props> = ({ data, darkMode, onReset }) => {
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
						color: #0f172a;
						background: #ffffff;
						padding: 40px;
						margin: 0;
					}
					.header {
						display: flex;
						justify-content: space-between;
						border-bottom: 2px solid #0f172a;
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
						color: #64748b;
						font-size: 11px;
					}
					.meta-ledger {
						text-align: right;
						font-family: monospace;
						font-size: 11px;
						color: #475569;
					}
					.diagnostic-summary {
						display: flex;
						gap: 20px;
						margin-bottom: 30px;
					}
					.summary-box {
						flex: 1;
						border: 1px solid #e2e8f0;
						padding: 20px;
					}
					.summary-box h3 {
						margin: 0 0 10px 0;
						font-size: 12px;
						color: #64748b;
						text-transform: uppercase;
						letter-spacing: 1.5px;
					}
					.summary-box p {
						margin: 0;
						font-size: 24px;
						font-weight: 700;
					}
					.severity-badge-0 { color: #10b981; }
					.severity-badge-1 { color: #f59e0b; }
					.severity-badge-2 { color: #f97316; }
					.severity-badge-3 { color: #ef4444; }
					
					.signal-strip-container {
						border: 1px solid #e2e8f0;
						padding: 20px;
						margin-bottom: 40px;
					}
					.signal-strip-container h3 {
						margin: 0 0 15px 0;
						font-size: 12px;
						color: #64748b;
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
						background: #f8fafc;
						border: 1px solid #e2e8f0;
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
						color: #0f172a;
					}

					.sign-off-zone {
						margin-top: 80px;
						display: flex;
						justify-content: space-between;
						align-items: flex-end;
						border-top: 1px dashed #cbd5e1;
						padding-top: 30px;
					}
					.signature-box {
						width: 250px;
						border-bottom: 1px solid #0f172a;
						height: 50px;
					}
					.signature-label {
						font-family: monospace;
						font-size: 11px;
						color: #64748b;
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
						<p style="color: #06b6d4">${data.confidence}%</p>
					</div>
					<div class="summary-box">
						<h3>Calculated AF Burden</h3>
						<p style="color: #10b981">${data.burden}%</p>
					</div>
				</div>

				<div class="signal-strip-container">
					<h3>10-Second Waveform Strip (R-Peaks Annotated)</h3>
					<p style="font-size: 13px; color: #64748b; margin: -5px 0 15px 0; font-family: monospace;">
						ECG Lead I: annotated with ${data.rPeaks?.length ?? 0} isolated R-peak landmarks.
					</p>
					<div style="height: 180px; border: 1px solid #cbd5e1; display: flex; align-items: center; justify-content: center; background: #fafafa; font-family: monospace; font-size: 12px; color: #64748b;">
						[ High-resolution layout capture vector details loaded natively in main interface strip ]
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
						<div style="font-family: monospace; font-size: 11px; text-align: right; color: #94a3b8;">
							Classification Model Version: 1D CNN-LSTM v1.0.0
						</div>
					</div>
				</div>

				<script>
					window.onload = function() {
						setTimeout(function() {
							window.print();
						}, 500);
					}
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
						backgroundColor: ["#22d3ee", darkMode ? "#1e293b" : "#e2e8f0"],
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
	}, [data, darkMode]);

	return (
		<div className="w-full text-slate-900 dark:text-white transition-colors duration-300">
			<div className="w-full max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
				<div className="lg:col-span-2 space-y-6">
					<div className="glass rounded-none p-6 bg-white dark:bg-white/5 backdrop-blur-md border border-slate-200 dark:border-white/10 shadow-sm dark:shadow-none">
						<div className="flex items-center justify-between gap-4 flex-wrap">
							<div>
								<h1 className="text-3xl font-bold">Diagnosis Dashboard</h1>
								<p className="text-slate-500 dark:text-slate-300 mt-1">Atrial Fibrillation Severity Analysis</p>
							</div>
							<div className="flex items-center gap-4 flex-wrap">
								<button
									onClick={exportReport}
									className="px-4 py-2.5 text-xs font-mono font-bold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-none shadow-xs transition-all cursor-pointer active:scale-95 shrink-0"
								>
									EXPORT REPORT
								</button>
								<div className={`px-6 py-3 rounded-none border ${severityInfo.bg} ${severityInfo.border}`}>
									<p className="text-sm uppercase tracking-wider opacity-80">Severity Status</p>
									<h2 className={`text-3xl font-bold ${severityInfo.color}`}>
										{severityInfo.label}
									</h2>
								</div>
							</div>
						</div>
					</div>

					<div className="lg:col-span-2">
						<WaveformChart signal={data.rawSignal} darkMode={darkMode} severity={data.severity} rPeaks={data.rPeaks} />
					</div>

					<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
						<div className="glass rounded-none p-6 bg-white dark:bg-white/5 backdrop-blur-md border border-slate-200 dark:border-white/10 shadow-sm dark:shadow-none">
							<div className="flex items-center justify-between mb-4">
								<div>
									<h3 className="text-xl font-semibold">Confidence Gauge</h3>
									<p className="text-slate-500 dark:text-slate-400 text-sm">Softmax Probability</p>
								</div>
								<div className="text-right">
									<p className="text-4xl font-bold text-cyan-600 dark:text-cyan-400">{data.confidence}%</p>
								</div>
							</div>
							<div className="h-72 flex items-center justify-center">
								<canvas ref={chartRef}></canvas>
							</div>
						</div>

						<div className="glass rounded-none p-6 bg-white dark:bg-white/5 backdrop-blur-md border border-slate-200 dark:border-white/10 shadow-sm dark:shadow-none flex flex-col justify-between">
							<div className="flex items-center justify-between mb-4">
								<div>
									<h3 className="text-xl font-semibold">AF Burden Meter</h3>
									<p className="text-slate-500 dark:text-slate-400 text-sm">Calculated AF Burden</p>
								</div>
								<div className="text-right">
									<p className="text-4xl font-bold text-emerald-600 dark:text-emerald-400">{data.burden}%</p>
								</div>
							</div>
							<div className="mt-6 flex-1 flex flex-col justify-center">
								<div className="w-full h-8 bg-slate-200 dark:bg-slate-800 rounded-none overflow-hidden">
									<div
										className="h-full bg-linear-to-r from-emerald-400 to-green-500 rounded-none flex items-center justify-end pr-4 font-semibold transition-all duration-500"
										style={{ width: `${data.burden}%` }}
									>
										{data.burden}%
									</div>
								</div>
								<div className="flex justify-between text-xs text-slate-500 dark:text-slate-400 mt-3">
									<span>Normal</span>
									<span>Trace</span>
									<span>Mild</span>
									<span>Severe</span>
								</div>
							</div>
						</div>

						<div className="glass rounded-none p-6 bg-white dark:bg-white/5 backdrop-blur-md border border-slate-200 dark:border-white/10 shadow-sm dark:shadow-none flex flex-col justify-between">
							<div className="flex items-center justify-between mb-4">
								<div>
									<h3 className="text-xl font-semibold">Landmark DSP</h3>
									<p className="text-slate-500 dark:text-slate-400 text-sm">Algorithmic Gating</p>
								</div>
								<div className="text-right">
									<p className="text-sm font-mono text-cyan-600 dark:text-cyan-400 font-bold">Peaks: {data.rPeaks?.length ?? 0}</p>
								</div>
							</div>
							<div className="space-y-4 my-2 flex-1 flex flex-col justify-center">
								<div className="bg-slate-100/50 dark:bg-slate-900/40 p-3 border border-slate-200/50 dark:border-slate-800/80">
									<div className="flex justify-between text-[11px] font-mono text-slate-400 mb-1">
										<span>R-R Variance</span>
										<span className="text-cyan-600 dark:text-cyan-400 font-bold">{data.rrVariance ?? 0.0} ms²</span>
									</div>
									<div className="w-full h-1.5 bg-slate-200 dark:bg-slate-800">
										<div 
											className="h-full bg-cyan-500" 
											style={{ width: `${Math.min((data.rrVariance ?? 0.0) / 10.0, 100.0)}%` }}
										/>
									</div>
								</div>
								<div className="bg-slate-100/50 dark:bg-slate-900/40 p-3 border border-slate-200/50 dark:border-slate-800/80">
									<div className="flex justify-between text-[11px] font-mono text-slate-400 mb-1">
										<span>RMSSD</span>
										<span className="text-emerald-600 dark:text-emerald-400 font-bold">{data.rmssd ?? 0.0} ms</span>
									</div>
									<div className="w-full h-1.5 bg-slate-200 dark:bg-slate-800">
										<div 
											className="h-full bg-emerald-500" 
											style={{ width: `${Math.min((data.rmssd ?? 0.0) / 2.0, 100.0)}%` }}
										/>
									</div>
								</div>
							</div>
							<div className="text-[10px] font-mono text-slate-400 tracking-normal mt-2 border-t border-slate-100 dark:border-slate-800/80 pt-2 shrink-0">
								{data.severity === 0 ? "Sinus rhythm: uniform peak intervals." : 
								 data.severity === 1 ? "Trace AFib: minor temporal peak jitter." : 
								 data.severity === 2 ? "Mild AFib: elevated R-R segment variance." : 
								 "Severe AFib: highly erratic gating landmarks."}
							</div>
						</div>
					</div>

					<div className="glass rounded-none p-6 bg-white dark:bg-white/5 backdrop-blur-md border border-slate-200 dark:border-white/10 shadow-sm dark:shadow-none">
						<div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
							<div>
								<h3 className="text-xl font-semibold">Inference Metadata</h3>
								<p className="text-slate-500 dark:text-slate-400 text-sm">Runtime diagnostics</p>
							</div>
							<div className="flex gap-4 flex-wrap">
								<div className="bg-slate-100 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-700 rounded-none px-5 py-4 min-w-45">
									<p className="text-slate-500 dark:text-slate-400 text-sm">Hardware Used</p>
									<div className="flex items-center gap-2 mt-1">
										<span className="w-3.5 h-3.5 bg-green-400"></span>
										<span className="text-lg font-semibold uppercase">{data.hardware}</span>
									</div>
								</div>
								<div className="bg-slate-100 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-700 rounded-none px-5 py-4 min-w-45">
									<p className="text-slate-500 dark:text-slate-400 text-sm">Response Time</p>
									<div className="flex items-center gap-2 mt-1">
										<span className="text-lg font-semibold">{data.responseTime} ms</span>
									</div>
								</div>
								<button
									onClick={onReset}
									className="bg-cyan-600 dark:bg-cyan-500 hover:bg-cyan-500 dark:hover:bg-cyan-400 text-white dark:text-slate-950 rounded-none px-6 py-4 font-bold transition-colors cursor-pointer"
								>
									NEW SCAN
								</button>
							</div>
						</div>
					</div>
				</div>

				<div className="glass rounded-none p-6 flex flex-col bg-white dark:bg-white/5 backdrop-blur-md border border-slate-200 dark:border-white/10 shadow-sm dark:shadow-none">
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
											: "bg-slate-50/50 dark:bg-slate-900/10 border-slate-100 dark:border-slate-800/60 opacity-40 hover:opacity-60 scale-98 cursor-default"
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
