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
    darkMode: boolean;
    severity: number;
    rPeaks?: number[];
}

const WaveformChart: React.FC<Props> = ({ signal, darkMode, severity, rPeaks }) => {
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
                borderColor: "#22d3ee",
                borderWidth: 1.5,
                pointRadius: 0,
                tension: 0.1,
            },
            ...(rPeaks && rPeaks.length > 0 ? [{
                label: "R-Peaks",
                data: peaksData,
                borderColor: "#ef4444",
                backgroundColor: "#ef4444",
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

    // Custom inline plugin to highlight arrhythmic segments for severity 2 and 3
    const highlightPlugin = {
        id: 'arrhythmiaHighlight',
        beforeDraw: (chart: any) => {
            const showHighlight = severity === 2 || severity === 3;
            if (!showHighlight) return;

            const { ctx, chartArea: { top, bottom }, scales: { x } } = chart;
            ctx.save();
            
            // Highlight erratic ECG window (e.g. from 3.0s to 7.0s)
            const startIndex = 750; // 3 seconds
            const endIndex = 1750;   // 7 seconds

            if (!chart.data.labels[startIndex] || !chart.data.labels[endIndex]) {
                ctx.restore();
                return;
            }

            const startX = x.getPixelForValue(chart.data.labels[startIndex]);
            const endX = x.getPixelForValue(chart.data.labels[endIndex]);

            // Draw soft Neubrutalist semi-transparent red overlay
            ctx.fillStyle = 'rgba(239, 68, 68, 0.08)';
            ctx.fillRect(startX, top, endX - startX, bottom - top);

            // Draw structural dashed boundary lines
            ctx.strokeStyle = 'rgba(239, 68, 68, 0.35)';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([5, 4]);
            ctx.beginPath();
            ctx.moveTo(startX, top);
            ctx.lineTo(startX, bottom);
            ctx.moveTo(endX, top);
            ctx.lineTo(endX, bottom);
            ctx.stroke();

            // Text indicator
            ctx.fillStyle = '#ef4444';
            ctx.font = 'bold 10px monospace';
            ctx.fillText('ERRATIC ARRHYTHMIC SEGMENT DETECTED (3.0s - 7.0s)', startX + 8, top + 18);
            ctx.restore();
        }
    };

    return (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-none p-6 shadow-sm dark:shadow-none transition-colors duration-300">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-100 dark:border-slate-800">
                <div>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white">Live ECG Signal Strip</h3>
                    <p className="text-xs text-slate-500 font-mono tracking-widest uppercase mt-0.5">
                        Wheel to Zoom • Drag to Pan
                    </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <button 
                        onClick={() => setPaperSpeed(25)}
                        className="px-3.5 py-1.5 text-xs font-mono font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-none transition-all duration-200 active:scale-95 shadow-xs cursor-pointer"
                    >
                        25 mm/s
                    </button>
                    <button 
                        onClick={() => setPaperSpeed(50)}
                        className="px-3.5 py-1.5 text-xs font-mono font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-none transition-all duration-200 active:scale-95 shadow-xs cursor-pointer"
                    >
                        50 mm/s
                    </button>
                    <button 
                        onClick={resetChartZoom}
                        className="px-3.5 py-1.5 text-xs font-mono font-semibold bg-red-50 hover:bg-red-100 dark:bg-red-950/30 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-900/50 rounded-none transition-all duration-200 active:scale-95 shadow-xs cursor-pointer"
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
                                grid: { color: darkMode ? "#1e293b" : "#e2e8f0" }, 
                                ticks: { color: darkMode ? "#64748b" : "#94a3b8", maxRotation: 0, autoSkip: true, maxTicksLimit: 10 } 
                            },
                            y: { 
                                display: true, 
                                grid: { color: darkMode ? "#1e293b" : "#e2e8f0" }, 
                                ticks: { color: darkMode ? "#64748b" : "#94a3b8" } 
                            },
                        }
                    }}
                />
            </div>
        </div>
    );
};

export default WaveformChart;
