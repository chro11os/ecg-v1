import React, { useRef } from "react";
import { Line } from "react-chartjs-2";
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
} from "chart.js";
import zoomPlugin from "chartjs-plugin-zoom";

ChartJS.register(
    CategoryScale, 
    LinearScale, 
    PointElement, 
    LineElement, 
    Title, 
    Tooltip, 
    Legend,
    zoomPlugin
);

interface Props {
    signal: number[];
    burdenTier: number;
    rPeaks?: number[];
    gradCam?: number[];
}

const WaveformChart: React.FC<Props> = ({ signal, burdenTier, rPeaks, gradCam }) => {
    const chartRef = useRef<any>(null);

    const peaksData = new Array(signal.length).fill(null);
    if (rPeaks) {
        rPeaks.forEach(idx => {
            if (idx < peaksData.length) {
                peaksData[idx] = signal[idx];
            }
        });
    }

    const data = {
        labels: Array.from({ length: signal.length }, (_, i) => (i / 250).toFixed(2)),
        datasets: [
            {
                label: "Lead I ECG (voltage)",
                data: signal,
                borderColor: "#0066CC",
                borderWidth: 1.5,
                pointRadius: 0,
                tension: 0.1,
            },
            ...(rPeaks && rPeaks.length > 0 ? [{
                label: "R-Peaks",
                data: peaksData,
                borderColor: "#DC2626",
                backgroundColor: "#DC2626",
                pointRadius: 5,
                pointHoverRadius: 7,
                showLine: false,
            }] : [])
        ],
    };

    const resetChartZoom = () => {
        if (chartRef.current) {
            const chart = chartRef.current;
            chart.options.scales.x.min = undefined;
            chart.options.scales.x.max = undefined;
            chart.update();
            chart.resetZoom();
        }
    };

    const setPaperSpeed = (speed: 25 | 50) => {
        if (chartRef.current) {
            const chart = chartRef.current;
            // 25 mm/s means we show 2.5 seconds (625 samples)
            // 50 mm/s means we show 1.25 seconds (312 samples)
            const maxIndex = speed === 25 ? 625 : 312;
            chart.options.scales.x.min = 0;
            chart.options.scales.x.max = maxIndex;
            chart.update();
        }
    };

    // Custom inline plugin to highlight arrhythmic segments and overlay Grad-CAM heatmap
    const highlightPlugin = {
        id: 'arrhythmiaHighlight',
        beforeDraw: (chart: any) => {
            const { ctx, chartArea: { top, bottom }, scales: { x } } = chart;
            ctx.save();

            // 1. Draw Grad-CAM Heatmap if available
            if (gradCam && gradCam.length > 0) {
                const numSamples = Math.min(gradCam.length, chart.data.labels.length);
                for (let i = 0; i < numSamples - 1; i++) {
                    const label1 = chart.data.labels[i];
                    const label2 = chart.data.labels[i + 1];
                    if (label1 === undefined || label2 === undefined) break;

                    const x1 = x.getPixelForValue(label1);
                    const x2 = x.getPixelForValue(label2);
                    const val = gradCam[i]; // value scaled between [0, 1]

                    if (val > 0.02) {
                        // Interpolate solid red on white canvas background to avoid alpha transparency
                        const r = Math.round(255 - 35 * val);
                        const g = Math.round(255 - 217 * val);
                        const b = Math.round(255 - 217 * val);
                        ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
                        ctx.fillRect(x1, top, x2 - x1, bottom - top);
                    }
                }

                // Draw attention boundary line (2.0s mark, index 500)
                const boundaryIndex = 500;
                if (chart.data.labels[boundaryIndex]) {
                    const boundaryX = x.getPixelForValue(chart.data.labels[boundaryIndex]);
                    ctx.strokeStyle = '#99C2EC'; // Solid equivalent of 40% blue on white
                    ctx.lineWidth = 1.5;
                    ctx.setLineDash([4, 4]);
                    ctx.beginPath();
                    ctx.moveTo(boundaryX, top);
                    ctx.lineTo(boundaryX, bottom);
                    ctx.stroke();

                    // Text indicator for attention boundary
                    ctx.fillStyle = '#0066CC';
                    ctx.font = 'bold 9px monospace';
                    ctx.fillText('MODEL ATTENTION WINDOW (2.0s)', boundaryX - 175, top + 15);
                }
            }

            // 2. Draw traditional heuristic highlight for burden tiers 2 & 3
            const showHeuristicHighlight = burdenTier === 2 || burdenTier === 3;
            if (showHeuristicHighlight) {
                const startIndex = 750; // 3 seconds
                const endIndex = 1750;   // 7 seconds

                if (chart.data.labels[startIndex] && chart.data.labels[endIndex]) {
                    const startX = x.getPixelForValue(chart.data.labels[startIndex]);
                    const endX = x.getPixelForValue(chart.data.labels[endIndex]);

                    // Soft solid red overlay for heuristic region (equivalent to 4% red on white)
                    ctx.fillStyle = '#FEF6F6';
                    ctx.fillRect(startX, top, endX - startX, bottom - top);

                    // structural dashed boundary lines (equivalent to 20% red on white)
                    ctx.strokeStyle = '#F8D4D4';
                    ctx.lineWidth = 1.2;
                    ctx.setLineDash([5, 4]);
                    ctx.beginPath();
                    ctx.moveTo(startX, top);
                    ctx.lineTo(startX, bottom);
                    ctx.moveTo(endX, top);
                    ctx.lineTo(endX, bottom);
                    ctx.stroke();

                    // Text indicator
                    ctx.fillStyle = '#DC2626';
                    ctx.font = 'bold 9px monospace';
                    ctx.fillText('ERRATIC ARRHYTHMIC SEGMENT DETECTED (3.0s - 7.0s)', startX + 8, top + 15);
                }
            }

            ctx.restore();
        }
    };

    return (
        <div className="bg-card-bg border border-border-subtle rounded-none p-6 shadow-xs transition-colors duration-300">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-4 border-b border-border-subtle">
                <div>
                    <h3 className="text-xl font-bold text-text-primary">Live ECG Signal Strip</h3>
                    <p className="text-xs text-brand-secondary font-mono tracking-widest uppercase mt-0.5">
                        Wheel to Zoom • Drag to Pan
                    </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <button 
                        onClick={() => setPaperSpeed(25)}
                        className="px-3.5 py-1.5 text-xs font-mono font-semibold bg-bg-canvas hover:bg-border-subtle text-text-primary border border-border-subtle rounded-none transition-all duration-200 active:scale-95 shadow-xs cursor-pointer"
                    >
                        25 mm/s
                    </button>
                    <button 
                        onClick={() => setPaperSpeed(50)}
                        className="px-3.5 py-1.5 text-xs font-mono font-semibold bg-bg-canvas hover:bg-border-subtle text-text-primary border border-border-subtle rounded-none transition-all duration-200 active:scale-95 shadow-xs cursor-pointer"
                    >
                        50 mm/s
                    </button>
                    <button 
                        onClick={resetChartZoom}
                        className="px-3.5 py-1.5 text-xs font-mono font-semibold bg-status-critical-light hover:bg-status-critical-light-border text-status-critical border border-status-critical-light-border rounded-none transition-all duration-200 active:scale-95 shadow-xs cursor-pointer"
                    >
                        Reset Zoom
                    </button>
                </div>
            </div>
            
            <div className="h-64 cursor-crosshair">
                <Line
                    ref={chartRef}
                    data={data}
                    plugins={[highlightPlugin]}
                    options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: {
                                display: false,
                            },
                            zoom: {
                                pan: {
                                    enabled: true,
                                    mode: 'x',
                                },
                                zoom: {
                                    wheel: {
                                        enabled: true,
                                    },
                                    pinch: {
                                        enabled: true
                                    },
                                    mode: 'x',
                                }
                            }
                        },
                        scales: {
                            x: { 
                                display: true, 
                                grid: { color: "#E5E7EB" }, 
                                ticks: { color: "#4A5568", maxRotation: 0, autoSkip: true, maxTicksLimit: 10 } 
                            },
                            y: { 
                                display: true, 
                                grid: { color: "#E5E7EB" }, 
                                ticks: { color: "#4A5568" } 
                            },
                        }
                    }}
                />
            </div>
        </div>
    );
};

export default WaveformChart;
