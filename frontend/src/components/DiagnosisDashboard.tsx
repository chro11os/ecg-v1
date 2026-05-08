import React, { useEffect, useRef } from "react";
import Chart from "chart.js/auto";

type SeverityLevel = 0 | 1 | 2 | 3;

interface DiagnosisData {
  severity: SeverityLevel;
  confidence: number;
  burden: number;
  hardware: string;
  responseTime: number;
}
   {/* INPUT DATA */}
const diagnosisData: DiagnosisData = {
  severity: 2,
  confidence: 48,
  burden: 80,
  hardware: "mps",
  responseTime: 128,
};

const severityMap = {
  0: {
    label: "0 - Normal",
    color: "text-green-400",
    border: "border-green-500",
    bg: "bg-green-500/10",
    cardHighlight:
      "bg-green-500/20 border-green-500 shadow-lg shadow-green-500/30 scale-[1.02]",
  },

  1: {
    label: "1 - Trace",
    color: "text-yellow-400",
    border: "border-yellow-500",
    bg: "bg-yellow-500/10",
    cardHighlight:
      "bg-yellow-500/20 border-yellow-500 shadow-lg shadow-yellow-500/30 scale-[1.02]",
  },

  2: {
    label: "2 - Mild",
    color: "text-orange-400",
    border: "border-orange-500",
    bg: "bg-orange-500/10",
    cardHighlight:
      "bg-orange-500/20 border-orange-500 shadow-lg shadow-orange-500/30 scale-[1.02]",
  },

  3: {
    label: "3 - Severe",
    color: "text-red-400",
    border: "border-red-500",
    bg: "bg-red-500/10",
    cardHighlight:
      "bg-red-500/20 border-red-500 shadow-lg shadow-red-500/30 scale-[1.02]",
  },
};

const severityInfo = severityMap[diagnosisData.severity];

const DiagnosisDashboard: React.FC = () => {
  const chartRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!chartRef.current) return;

    const chart = new Chart(chartRef.current, {
  type: "doughnut",

  data: {
    datasets: [
      {
        data: [
          diagnosisData.confidence,
          100 - diagnosisData.confidence,
        ],
        backgroundColor: ["#22d3ee", "#1e293b"],
        borderWidth: 0,
      },
    ],
  },

  options: {
    responsive: true,
    cutout: "75%",

    plugins: {
      legend: {
        display: false,
      },

      tooltip: {
        enabled: false,
      },
    },
  },
});

    return () => {
      chart.destroy();
    };
  }, []);

  return (
    
    <div className="min-h-screen text-white flex items-center justify-center p-8 bg-gradient-to-br from-slate-900 to-gray-900">
      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div className="glass rounded-3xl p-6 bg-white/5 backdrop-blur-md border border-white/10">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold">
                  Diagnosis Dashboard
                </h1>

                <p className="text-slate-300 mt-1">
                  Atrial Fibrillation Severity Analysis
                </p>
              </div>

              <div
                className={`px-6 py-3 rounded-2xl border ${severityInfo.bg} ${severityInfo.border}`}
              >
                <p className="text-sm uppercase tracking-wider opacity-80">
                  Severity Status
                </p>

                <h2
                  className={`text-3xl font-bold ${severityInfo.color}`}
                >
                  {severityInfo.label}
                </h2>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="glass rounded-3xl p-6 bg-white/5 backdrop-blur-md border border-white/10">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-xl font-semibold">
                    Confidence Gauge
                  </h3>

                  <p className="text-slate-400 text-sm">
                    Softmax Probability
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-4xl font-bold text-cyan-400">
                    {diagnosisData.confidence}%
                  </p>
                </div>
              </div>

              <div className="h-72 flex items-center justify-center">
                <canvas ref={chartRef}></canvas>
              </div>
            </div>

            <div className="glass rounded-3xl p-6 bg-white/5 backdrop-blur-md border border-white/10">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-xl font-semibold">
                    AF Burden Meter
                  </h3>

                  <p className="text-slate-400 text-sm">
                    Calculated AF Burden
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-4xl font-bold text-emerald-400">
                    {diagnosisData.burden}%
                  </p>
                </div>
              </div>

              <div className="mt-10">
                <div className="w-full h-8 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-400 to-green-500 rounded-full flex items-center justify-end pr-4 font-semibold transition-all duration-500"
                    style={{
                      width: `${diagnosisData.burden}%`,
                    }}
                  >
                    {diagnosisData.burden}%
                  </div>
                </div>

                <div className="flex justify-between text-xs text-slate-400 mt-3">
                  <span>Normal</span>
                  <span>Trace</span>
                  <span>Mild</span>
                  <span>Severe</span>
                </div>
              </div>
            </div>
          </div>

          <div className="glass rounded-3xl p-6 bg-white/5 backdrop-blur-md border border-white/10">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h3 className="text-xl font-semibold">
                  Inference Metadata
                </h3>

                <p className="text-slate-400 text-sm">
                  Runtime diagnostics
                </p>
              </div>

              <div className="flex gap-4 flex-wrap">
                <div className="bg-slate-900/70 border border-slate-700 rounded-2xl px-5 py-4 min-w-[180px]">
                  <p className="text-slate-400 text-sm">
                    Hardware Used
                  </p>

                  <div className="flex items-center gap-2 mt-1">
                    <span className="w-3 h-3 rounded-full bg-green-400"></span>

                    <span className="text-lg font-semibold">
                      {diagnosisData.hardware}
                    </span>
                  </div>
                </div>

                <div className="bg-slate-900/70 border border-slate-700 rounded-2xl px-5 py-4 min-w-[180px]">
                  <p className="text-slate-400 text-sm">
                    Response Time
                  </p>

                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-lg font-semibold">
                      {diagnosisData.responseTime} ms
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="glass rounded-3xl p-6 flex flex-col bg-white/5 backdrop-blur-md border border-white/10">
          <h3 className="text-2xl font-bold mb-6">
            Severity Classes
          </h3>

          <div className="space-y-4">
            {[0, 1, 2, 3].map((level) => {
              const current = severityMap[level as SeverityLevel];
              const isActive =
                diagnosisData.severity === level;

              return (
                <div
                  key={level}
                  className={`p-4 rounded-2xl border transition-all duration-300
                  ${
                    isActive
                      ? current.cardHighlight
                      : "bg-slate-800 border-slate-700"
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <span className="font-semibold">
                      {current.label}
                    </span>

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