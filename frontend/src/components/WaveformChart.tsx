import React from "react";
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

ChartJS.register(
    CategoryScale, 
    LinearScale, 
    PointElement, 
    LineElement, 
    Title, 
    Tooltip, 
    Legend
);

interface Props {
    signal: number[];
}

const WaveformChart: React.FC<Props> = ({ signal }) => {
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
        ],
    };

    return (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6">
            <h3 className="text-xl font-bold text-white mb-4">Live ECG Signal Strip</h3>
            <div className="h-64">
                <Line
                    data={data}
                    options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: {
                                display: false,
                            },
                        },
                        scales: {
                            x: { 
                                display: true, 
                                grid: { color: "#1e293b" }, 
                                ticks: { color: "#64748b", maxRotation: 0, autoSkip: true, maxTicksLimit: 10 } 
                            },
                            y: { 
                                display: true, 
                                grid: { color: "#1e293b" }, 
                                ticks: { color: "#64748b" } 
                            },
                        }
                    }}
                />
            </div>
        </div>
    );
};

export default WaveformChart;
