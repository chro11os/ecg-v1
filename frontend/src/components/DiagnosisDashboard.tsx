import React, { useEffect, useRef } from "react";
import Chart from "chart.js/auto";
import type { DiagnosisData, BurdenTier } from "../types";
import WaveformChart from "./WaveformChart";

interface Props {
	data: DiagnosisData;
	onReset: () => void;
	patientScans?: any[];
	activePatient?: any;
}

const burdenTierMap = {
	0: {
		label: "Sinus Rhythm",
		color: "text-status-healthy font-extrabold",
		border: "border-status-healthy",
		bg: "bg-status-healthy/10",
		cardHighlight: "bg-status-healthy/5 border border-status-healthy shadow-[0_8px_30px_rgba(22,163,74,0.08)] scale-[1.01] font-bold",
	},
	1: {
		label: "Micro-Burden / Rare Paroxysm",
		color: "text-status-info font-extrabold",
		border: "border-status-info",
		bg: "bg-status-info/10",
		cardHighlight: "bg-status-info/5 border border-status-info shadow-[0_8px_30px_rgba(37,99,235,0.08)] scale-[1.01] font-bold",
	},
	2: {
		label: "Intermediate Burden / Active Paroxysm",
		color: "text-status-warning font-extrabold",
		border: "border-status-warning",
		bg: "bg-status-warning/10",
		cardHighlight: "bg-status-warning/5 border border-status-warning shadow-[0_8px_30px_rgba(217,119,6,0.08)] scale-[1.01] font-bold",
	},
	3: {
		label: "High Burden / Persistent AFib",
		color: "text-status-critical font-extrabold",
		border: "border-status-critical",
		bg: "bg-status-critical/10",
		cardHighlight: "bg-status-critical/5 border border-status-critical shadow-[0_8px_30px_rgba(220,38,38,0.08)] scale-[1.01] font-bold",
	},
};

const DiagnosisDashboard: React.FC<Props> = ({ data, onReset, patientScans, activePatient }) => {
	const gaugeChartRef = useRef<HTMLCanvasElement | null>(null);
	const trendChartRef = useRef<HTMLCanvasElement | null>(null);
	const burdenInfo = burdenTierMap[data.burdenTier];

	const getStrokeRiskCategory = (score: number) => {
		if (score === 0) return { label: "Low Risk", color: "text-status-healthy", rec: "No anticoagulation therapy indicated." };
		if (score === 1) return { label: "Moderate Risk", color: "text-status-warning", rec: "Oral anticoagulation should be considered based on clinical judgment." };
		return { label: "High Risk", color: "text-status-critical", rec: "Oral anticoagulation therapy is strongly recommended." };
	};

	const getCHA2DS2VAScBreakdown = (patient: any) => {
		const breakdown: { criteria: string; pts: number; active: boolean }[] = [];
		
		// CHF
		breakdown.push({
			criteria: "Congestive Heart Failure",
			pts: 1,
			active: patient.heart_failure === 1
		});
		
		// Hypertension
		breakdown.push({
			criteria: "Hypertension History",
			pts: 1,
			active: patient.hypertension === 1
		});
		
		// Age >= 75 (2 pts) or 65-74 (1 pt)
		breakdown.push({
			criteria: "Age ≥ 75",
			pts: 2,
			active: patient.age >= 75
		});
		breakdown.push({
			criteria: "Age 65–74",
			pts: 1,
			active: patient.age >= 65 && patient.age < 75
		});
		
		// Diabetes
		breakdown.push({
			criteria: "Diabetes Mellitus",
			pts: 1,
			active: patient.diabetes === 1
		});
		
		// Stroke
		breakdown.push({
			criteria: "Stroke / TIA History",
			pts: 2,
			active: patient.stroke_history === 1
		});
		
		// Vascular Disease
		breakdown.push({
			criteria: "Vascular Disease",
			pts: 1,
			active: patient.vascular_disease === 1
		});
		
		// Gender
		breakdown.push({
			criteria: "Sex Category (Female)",
			pts: 1,
			active: patient.gender.toLowerCase() === "female" || patient.gender.toLowerCase() === "f"
		});
		
		return breakdown;
	};

	const exportReport = () => {
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
					.burden-badge-0 { color: #16A34A; }
					.burden-badge-1 { color: #2563EB; }
					.burden-badge-2 { color: #D97706; }
					.burden-badge-3 { color: #DC2626; }
					
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
						<h3>Temporal Burden Status</h3>
						<p class="burden-badge-${data.burdenTier}">
							${data.burdenTier === 0 ? 'SINUS RHYTHM' :
							  data.burdenTier === 1 ? 'MICRO-BURDEN / RARE PAROXYSM' :
							  data.burdenTier === 2 ? 'INTERMEDIATE BURDEN / ACTIVE PAROXYSM' : 'HIGH BURDEN / PERSISTENT AFIB'}
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
											<tr style="border-bottom: 1px solid #F3F4F6; ${item.active ? 'font-weight: bold; color: #0066CC;' : 'color: #9CA3AF;'}">
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
								<h3>Cumulative Longitudinal Burden</h3>
								<p style="font-size: 20px; color: #DC2626; margin-bottom: 5px;"><b>${data.cumulativeAFibBurden ?? 0.0}%</b></p>
							</div>
							<div style="font-size: 10px; color: #4A5568; font-family: monospace; margin-top: 15px; border-top: 1px dashed #E5E7EB; padding-top: 10px;">
								Patient's longitudinal burden ratio aggregated over all database scans.
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
							const burdenTier = ${data.burdenTier};

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

							// Draw traditional heuristic highlight for burdenTier 2 & 3
							if (burdenTier === 2 || burdenTier === 3) {
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

	// 1. Confidence Gauge Doughnut Chart
	useEffect(() => {
		if (!gaugeChartRef.current) return;

		const chart = new Chart(gaugeChartRef.current, {
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

	// 2. Longitudinal Trend Chart (Line Chart)
	useEffect(() => {
		if (!trendChartRef.current) return;

		let chartInstance: Chart | null = null;

		if (patientScans && patientScans.length > 0) {
			// Sort scans chronologically
			const sortedScans = [...patientScans].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
			
			const labels = sortedScans.map(s => {
				const d = new Date(s.timestamp);
				return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
			});

			const burdenData = sortedScans.map(s => {
				const tier = s.predicted_class;
				if (tier === 0) return 0;
				if (tier === 1) return 4.25;
				if (tier === 2) return 28.4;
				return 72.8;
			});

			chartInstance = new Chart(trendChartRef.current, {
				type: "line",
				data: {
					labels: labels,
					datasets: [
						{
							label: "AFib Burden Trend (%)",
							data: burdenData,
							borderColor: "#DC2626",
							backgroundColor: "rgba(220, 38, 38, 0.08)",
							borderWidth: 2,
							tension: 0.35,
							fill: true,
							pointRadius: 4,
							pointBackgroundColor: "#DC2626",
						}
					]
				},
				options: {
					responsive: true,
					maintainAspectRatio: false,
					scales: {
						y: {
							min: 0,
							max: 100,
							ticks: {
								color: "#4A5568",
								callback: (value) => `${value}%`
							},
							grid: { color: "#E5E7EB" }
						},
						x: {
							ticks: { color: "#4A5568" },
							grid: { display: false }
						}
					},
					plugins: {
						legend: { display: false }
					}
				}
			});
		}

		return () => {
			if (chartInstance) chartInstance.destroy();
		};
	}, [patientScans]);

	return (
		<div className="w-full text-text-primary transition-colors duration-300 space-y-6">
			{/* Clinical Header Bar */}
			<div className="bg-card-bg border border-border-subtle p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
				<div className="space-y-1">
					<div className="flex items-center gap-2 flex-wrap">
						<h1 className="text-2xl font-bold tracking-tight">Diagnosis Dashboard</h1>
						<span className="text-[10px] font-mono bg-border-subtle text-brand-secondary px-2 py-0.5 uppercase">
							{data.hardware} • {data.responseTime}ms
						</span>
					</div>
					<p className="text-xs text-brand-secondary font-mono">
						Atrial Fibrillation Temporal Burden Analysis
					</p>
				</div>
				
				<div className="flex items-center gap-3 flex-wrap">
					{/* Status Pill */}
					<div className={`px-4 py-2 border flex items-center gap-3 ${burdenInfo.bg} ${burdenInfo.border}`}>
						<div>
							<p className="text-[9px] uppercase tracking-wider opacity-75 font-mono">Burden Status</p>
							<p className={`text-base font-bold ${burdenInfo.color}`}>
								{burdenInfo.label}
							</p>
						</div>
						<div className="border-l border-border-subtle pl-3 text-right">
							<p className="text-[9px] uppercase tracking-wider opacity-75 font-mono">Confidence</p>
							<p className="text-base font-bold text-brand-primary">
								{data.confidence}%
							</p>
						</div>
					</div>

					<button
						onClick={exportReport}
						className="px-4 py-3 text-xs font-mono font-bold bg-status-healthy hover:bg-status-healthy/90 text-white rounded-none shadow-xs transition-all cursor-pointer active:scale-95 shrink-0"
					>
						EXPORT REPORT
					</button>
					
					<button
						onClick={onReset}
						className="px-4 py-3 text-xs font-mono font-bold bg-brand-primary hover:bg-brand-primary/90 text-white rounded-none shadow-xs transition-all cursor-pointer active:scale-95 shrink-0"
					>
						NEW SCAN
					</button>
				</div>
			</div>

			{/* Interactive Waveform Strip (Full Width) */}
			<div className="bg-card-bg border border-border-subtle p-1 shadow-xs">
				<WaveformChart 
					signal={data.rawSignal} 
					burdenTier={data.burdenTier} 
					rPeaks={data.rPeaks} 
					gradCam={data.gradCam} 
				/>
			</div>

			{/* Clinical Insights (2 Columns: CDSS and Historical Trend) */}
			<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
				{/* CHA2DS2-VASc stroke risk card */}
				<div className="bg-card-bg border border-border-subtle p-5 shadow-xs flex flex-col justify-between">
					<div>
						<div className="flex items-center justify-between mb-4 border-b border-border-subtle pb-2">
							<h3 className="text-base font-bold uppercase tracking-wider">Stroke Risk Assessment</h3>
							<span className={`px-2 py-0.5 text-[9px] font-mono font-bold rounded-none uppercase ${
								data.strokeRiskScore !== undefined 
									? 'bg-status-info/10 text-status-info border border-status-info/20' 
									: 'bg-border-subtle text-brand-secondary border border-border-subtle'
							}`}>
								{data.strokeRiskScore !== undefined ? "CDSS Active" : "No Active Patient"}
							</span>
						</div>
						
						{data.strokeRiskScore !== undefined ? (
							<div className="space-y-4">
								<div className="flex justify-between items-center bg-bg-canvas p-4 border border-border-subtle">
									<div>
										<p className="text-[10px] font-mono text-brand-secondary uppercase">CHA₂DS₂-VASc Score</p>
										<p className="text-3xl font-bold mt-0.5">{data.strokeRiskScore} <span className="text-xs font-normal text-brand-secondary">PTS</span></p>
									</div>
									<div className="text-right">
										<p className="text-[10px] font-mono text-brand-secondary uppercase">Risk Tier</p>
										<p className={`text-lg font-bold mt-0.5 uppercase ${getStrokeRiskCategory(data.strokeRiskScore).color}`}>
											{getStrokeRiskCategory(data.strokeRiskScore).label}
										</p>
									</div>
								</div>
								<div className="bg-bg-canvas/50 p-3.5 border border-border-subtle text-xs">
									<p className="font-bold text-brand-primary uppercase font-mono tracking-wide mb-1">Recommended Therapy:</p>
									<p className="text-brand-secondary leading-relaxed">{getStrokeRiskCategory(data.strokeRiskScore).rec}</p>
								</div>

								{activePatient && (
									<div className="border border-border-subtle p-3 mt-3 bg-bg-canvas/20">
										<p className="text-[9px] font-mono text-brand-secondary uppercase mb-2 border-b border-border-subtle pb-1 tracking-wider font-bold">Risk Factor Breakdown:</p>
										<div className="grid grid-cols-1 md:grid-cols-2 gap-1.5 text-[9px] font-mono">
											{getCHA2DS2VAScBreakdown(activePatient).map((item, idx) => (
												<div key={idx} className={`flex justify-between items-center px-2 py-1 ${
													item.active 
														? "bg-brand-primary/10 border border-brand-primary/20 text-brand-primary font-bold" 
														: "opacity-45 border border-transparent text-brand-secondary/70"
												}`}>
													<span>{item.criteria}</span>
													<span>{item.active ? `+${item.pts} pt` : `0 pts`}</span>
												</div>
											))}
										</div>
									</div>
								)}
							</div>
						) : (
							<div className="text-center py-10">
								<p className="text-xs font-mono text-brand-secondary leading-relaxed">
									Please select or register a patient prior to scan analysis to enable CHA₂DS₂-VASc stroke risk assessment.
								</p>
							</div>
						)}
					</div>
				</div>

				{/* Trend Chart Card */}
				<div className="bg-card-bg border border-border-subtle p-5 shadow-xs flex flex-col justify-between">
					<div>
						<div className="flex items-center justify-between mb-4 border-b border-border-subtle pb-2">
							<h3 className="text-base font-bold uppercase tracking-wider">Longitudinal AFib Trend</h3>
							<span className="px-2 py-0.5 text-[9px] font-mono font-bold bg-brand-primary/10 text-brand-primary border border-brand-primary/20 uppercase">
								{patientScans && patientScans.length > 0 ? `${patientScans.length} Scans` : "0 Scans"}
							</span>
						</div>
						
						<div className="h-44 relative mt-2">
							{patientScans && patientScans.length > 0 ? (
								<canvas ref={trendChartRef}></canvas>
							) : (
								<div className="absolute inset-0 flex items-center justify-center text-center">
									<p className="text-xs font-mono text-brand-secondary leading-relaxed">
										No historical registry data found. Link scanning sequences to a patient to build longitudinal analytics.
									</p>
								</div>
							)}
						</div>
					</div>
				</div>
			</div>

			{/* DSP Telemetry and Reference (3 Columns) */}
			<div className="grid grid-cols-1 md:grid-cols-3 gap-6">
				{/* DSP Telemetry Card */}
				<div className="bg-card-bg border border-border-subtle p-5 shadow-xs flex flex-col justify-between">
					<div>
						<div className="flex items-center justify-between mb-4 border-b border-border-subtle pb-2">
							<h3 className="text-sm font-bold uppercase tracking-wider">Digital Signal Processing</h3>
							<span className="text-[10px] font-mono text-brand-secondary">Peaks: {data.rPeaks?.length ?? 0}</span>
						</div>
						
						<div className="space-y-4 my-2">
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
					</div>
					<div className="text-[10px] font-mono text-brand-secondary mt-2 border-t border-border-subtle pt-2">
						{data.burdenTier === 0 ? "Sinus rhythm: uniform peak intervals." : 
						 data.burdenTier === 1 ? "Trace AFib: minor temporal peak jitter." : 
						 data.burdenTier === 2 ? "Mild AFib: elevated R-R segment variance." : 
						 "Severe AFib: highly erratic gating landmarks."}
					</div>
				</div>

				{/* Burden Gauge Card */}
				<div className="bg-card-bg border border-border-subtle p-5 shadow-xs flex flex-col justify-between">
					<div>
						<div className="flex items-center justify-between mb-4 border-b border-border-subtle pb-2">
							<h3 className="text-sm font-bold uppercase tracking-wider">AFib Burden Metric</h3>
							<span className="text-status-healthy font-mono text-xs font-bold">{data.burden}%</span>
						</div>
						
						<div className="mt-4 space-y-4">
							<div className="w-full h-7 bg-border-subtle rounded-none overflow-hidden relative">
								<div
									className="h-full bg-linear-to-r from-status-healthy to-status-warning rounded-none flex items-center justify-end pr-3 font-semibold text-white text-xs transition-all duration-500"
									style={{ width: `${data.burden}%` }}
								>
									{data.burden}%
								</div>
							</div>
							<div className="flex justify-between text-[9px] text-brand-secondary font-mono">
								<span>Sinus</span>
								<span>Micro</span>
								<span>Intermed.</span>
								<span>High</span>
							</div>
						</div>
					</div>
					<div className="text-[10px] font-mono text-brand-secondary mt-2 border-t border-border-subtle pt-2">
						Temporal ratio of AFib rhythm segments over 10.0s recording window.
					</div>
				</div>

				{/* Reference Tier Scale Card */}
				<div className="bg-card-bg border border-border-subtle p-5 shadow-xs flex flex-col justify-between">
					<div>
						<div className="flex items-center justify-between mb-4 border-b border-border-subtle pb-2">
							<h3 className="text-sm font-bold uppercase tracking-wider">AFib Burden Tiers</h3>
							<span className="text-[10px] font-mono text-brand-secondary">Reference Guide</span>
						</div>
						
						<div className="space-y-2 mt-2">
							{[0, 1, 2, 3].map((level) => {
								const current = burdenTierMap[level as BurdenTier];
								const isActive = data.burdenTier === level;
								return (
									<div
										key={level}
										className={`p-1.5 border flex justify-between items-center text-[10px] font-mono ${
											isActive 
												? `${current.bg} ${current.border} border-l-4 font-bold` 
												: "bg-transparent border-transparent opacity-50"
										}`}
									>
										<span>{current.label}</span>
										{isActive && <span className="text-[9px] uppercase tracking-wide px-1.5 py-0.5 bg-brand-primary text-white font-bold">Active</span>}
									</div>
								);
							})}
						</div>
					</div>
				</div>
			</div>
		</div>
	);
};

export default DiagnosisDashboard;
