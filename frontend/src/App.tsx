import { useState, useEffect } from "react";
import type { DiagnosisData, SeverityLevel } from "./types";
import DiagnosisDashboard from "./components/DiagnosisDashboard";
import FileUploadArea from "./components/FileUploadArea";

interface HistoryItem {
    id: string;
    fileName: string;
    timestamp: string;
    severity: SeverityLevel;
    confidence: number;
    burden: number;
    hardware: string;
    responseTime: number;
    rawSignal: number[];
    rPeaks?: number[];
    rrVariance?: number;
    rmssd?: number;
}

interface PatientScan {
    scanId: string;
    date: string;
    severity: SeverityLevel;
    confidence: number;
    burden: number;
    hardware: string;
    responseTime: number;
    rawSignal: number[];
    rPeaks: number[];
    rrVariance: number;
    rmssd: number;
}

interface PatientRecord {
    patientId: string;
    name: string;
    age: number;
    gender: string;
    scans: PatientScan[];
}

// Procedural ECG signal generator matching synthetic parameters for perfect testing hydration
const generateProceduralECG = (type: "normal" | "trace" | "mild" | "severe"): number[] => {
    const signal: number[] = [];
    const fs = 250;
    const seconds = 10;
    const length = fs * seconds;
    
    let bpm = 72;
    let noiseLevel = 0.05;
    let peakHeight = 2.5;
    
    if (type === "trace") {
        bpm = 78;
        noiseLevel = 0.1;
        peakHeight = 2.3;
    } else if (type === "mild") {
        bpm = 100;
        noiseLevel = 0.15;
        peakHeight = 2.0;
    } else if (type === "severe") {
        bpm = 135;
        noiseLevel = 0.35;
        peakHeight = 1.8;
    }
    
    const interval = Math.round((fs * 60) / bpm);
    
    for (let i = 0; i < length; i++) {
        const baseline = 0.12 * Math.sin(2.0 * Math.PI * 0.15 * (i / fs));
        const noise = (Math.random() - 0.5) * 2.0 * noiseLevel;
        let peak = 0.0;
        const phase = i % interval;
        if (phase < 15) {
            peak = peakHeight * Math.exp(-Math.pow(phase - 7, 2) / 8.0);
        }
        signal.push(Number((peak + baseline + noise).toFixed(4)));
    }
    return signal;
};

// Seed patient registry data
const mockPatientRecords: PatientRecord[] = [
    {
        patientId: "#8492-A",
        name: "Arthur Pendelton",
        age: 62,
        gender: "male",
        scans: [
            {
                scanId: "SCAN-01",
                date: "2026-05-20",
                severity: 0,
                confidence: 95,
                burden: 0.0,
                hardware: "mps",
                responseTime: 18,
                rawSignal: generateProceduralECG("normal"),
                rPeaks: [2, 105, 206, 313, 415, 525, 626, 729, 836, 939, 1044, 1144, 1249, 1350, 1455, 1558, 1668, 1773, 1877, 1978, 2085, 2188, 2292, 2395, 2496],
                rrVariance: 115.89,
                rmssd: 18.24
            },
            {
                scanId: "SCAN-02",
                date: "2026-05-24",
                severity: 2,
                confidence: 85,
                burden: 28.4,
                hardware: "mps",
                responseTime: 22,
                rawSignal: generateProceduralECG("mild"),
                rPeaks: [75, 225, 375, 525, 675, 825, 975, 1125, 1275, 1425, 1575, 1725, 1875, 2025, 2175, 2325, 2475],
                rrVariance: 385.12,
                rmssd: 34.67
            }
        ]
    },
    {
        patientId: "#1039-B",
        name: "Eleanor Vance",
        age: 45,
        gender: "female",
        scans: [
            {
                scanId: "SCAN-01",
                date: "2026-05-18",
                severity: 3,
                confidence: 92,
                burden: 72.8,
                hardware: "cpu",
                responseTime: 45,
                rawSignal: generateProceduralECG("severe"),
                rPeaks: [55, 166, 277, 388, 499, 610, 721, 832, 943, 1054, 1165, 1276, 1387, 1498, 1609, 1720, 1831, 1942, 2053, 2164, 2275, 2386, 2497],
                rrVariance: 845.32,
                rmssd: 58.91
            }
        ]
    },
    {
        patientId: "#4812-C",
        name: "David Vance",
        age: 71,
        gender: "male",
        scans: [
            {
                scanId: "SCAN-01",
                date: "2026-05-25",
                severity: 1,
                confidence: 89,
                burden: 4.25,
                hardware: "mps",
                responseTime: 19,
                rawSignal: generateProceduralECG("trace"),
                rPeaks: [96, 288, 480, 672, 864, 1056, 1248, 1440, 1632, 1824, 2016, 2208, 2400],
                rrVariance: 148.24,
                rmssd: 22.15
            }
        ]
    }
];

export default function App() {
    const [diagnosis, setDiagnosis] = useState<DiagnosisData | null>(null);
    const [loading, setLoading] = useState(false);
    const [darkMode, setDarkMode] = useState(true);
    const [history, setHistory] = useState<HistoryItem[]>([]);
    const [historyOpen, setHistoryOpen] = useState(false);

    // Patients Sidebar States
    const [sidebarTab, setSidebarTab] = useState<"PATIENTS" | "SCANS">("PATIENTS");
    const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);

    useEffect(() => {
        if (darkMode) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }, [darkMode]);

    const handleAnalysis = async (incomingSignal: number[], fileName: string) => {
        setLoading(true);
        const startTime = performance.now();
        try {
            const response = await fetch("http://localhost:8000/predict", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ signal: incomingSignal }),
            });

            const result = await response.json();
            const endTime = performance.now();

            const severity: SeverityLevel = result.severity_class ?? 0;
            let simulatedBurden = 0.0;

            if (severity === 1) simulatedBurden = 4.25;
            else if (severity === 2) simulatedBurden = 28.4;
            else if (severity === 3) simulatedBurden = 72.8;

            const responseTime = Math.round(endTime - startTime);
            const confidence = Math.round((result.confidence ?? 0.0) * 100.0);
            const burden = severity === 0 ? 0.0 : simulatedBurden;

            const newDiagnosis: DiagnosisData = {
                severity: severity,
                confidence: confidence,
                burden: burden,
                hardware: result.hardware_used ?? "cpu",
                responseTime: responseTime,
                rawSignal: incomingSignal,
                rPeaks: result.r_peaks ?? [],
                rrVariance: result.rr_variance ?? 0.0,
                rmssd: result.rmssd ?? 0.0
            };

            setDiagnosis(newDiagnosis);

            const historyItem: HistoryItem = {
                id: Math.random().toString(36).substring(2, 9),
                fileName: fileName || "ecg_signal.json",
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }),
                ...newDiagnosis
            };

            setHistory(prev => [historyItem, ...prev]);
        } catch (error) {
            console.error("Inference Error:", error);
        } finally {
            setLoading(false);
        }
    };

    const loadHistoryItem = (item: HistoryItem) => {
        setDiagnosis({
            severity: item.severity,
            confidence: item.confidence,
            burden: item.burden,
            hardware: item.hardware,
            responseTime: item.responseTime,
            rawSignal: item.rawSignal,
            rPeaks: item.rPeaks,
            rrVariance: item.rrVariance,
            rmssd: item.rmssd
        });
        setHistoryOpen(false);
    };

    const loadPatientScan = (scan: PatientScan) => {
        setDiagnosis({
            severity: scan.severity,
            confidence: scan.confidence,
            burden: scan.burden,
            hardware: scan.hardware,
            responseTime: scan.responseTime,
            rawSignal: scan.rawSignal,
            rPeaks: scan.rPeaks,
            rrVariance: scan.rrVariance,
            rmssd: scan.rmssd
        });
        setHistoryOpen(false);
    };

    return (
        <div className="main bg-slate-50 dark:bg-slate-950 min-h-screen flex flex-col items-center justify-center p-6 transition-colors duration-300 relative overflow-x-hidden">
            {/* Top-Right and Top-Left Controls Dock */}
            <button
                onClick={() => setHistoryOpen(!historyOpen)}
                className="fixed top-6 left-6 px-4 py-2.5 rounded-none bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm z-50 hover:bg-slate-50 dark:hover:bg-slate-700/80 hover:border-cyan-400 dark:hover:border-cyan-400/50 hover:shadow-[0_4px_12px_rgba(34,211,238,0.08)] transition-all cursor-pointer font-mono font-bold text-xs text-slate-700 dark:text-slate-300 active:scale-95 animate-in fade-in duration-300"
            >
                ECG REGISTRY
            </button>

            <button
                onClick={() => setDarkMode(!darkMode)}
                className="fixed top-6 right-6 px-4 py-2.5 rounded-none bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm z-50 hover:bg-slate-50 dark:hover:bg-slate-700/80 hover:border-cyan-400 dark:hover:border-cyan-400/50 hover:shadow-[0_4px_12px_rgba(34,211,238,0.08)] transition-all cursor-pointer font-mono font-bold text-xs text-slate-700 dark:text-slate-300 active:scale-95 animate-in fade-in duration-300"
                aria-label="Toggle Theme"
            >
                THEME: {darkMode ? "LIGHT" : "DARK"}
            </button>

            {/* Sliding Drawer for Recent Scans and Patients Directory */}
            <div 
                className={`fixed inset-y-0 left-0 w-80 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 p-6 shadow-2xl z-40 transform transition-transform duration-300 ease-in-out flex flex-col ${
                    historyOpen ? 'translate-x-0' : '-translate-x-full'
                }`}
            >
                <div className="flex justify-between items-center mb-4 mt-16 pb-2">
                    <h2 className="text-lg font-bold font-mono tracking-wide text-slate-900 dark:text-white">ECG REGISTRY</h2>
                    <button 
                        onClick={() => setHistoryOpen(false)}
                        className="text-[10px] font-mono font-bold px-2 py-1 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 rounded-none cursor-pointer active:scale-95"
                    >
                        CLOSE
                    </button>
                </div>

                {/* Multi-Panel Tabs */}
                <div className="flex border-b border-slate-200 dark:border-slate-800 mb-4">
                    <button
                        onClick={() => setSidebarTab("PATIENTS")}
                        className={`flex-1 py-2 text-xs font-mono font-bold border-b-2 cursor-pointer transition-all ${
                            sidebarTab === "PATIENTS"
                                ? "border-cyan-500 text-cyan-600 dark:text-cyan-400"
                                : "border-transparent text-slate-400 dark:text-slate-500 hover:text-slate-600"
                        }`}
                    >
                        PATIENTS
                    </button>
                    <button
                        onClick={() => setSidebarTab("SCANS")}
                        className={`flex-1 py-2 text-xs font-mono font-bold border-b-2 cursor-pointer transition-all ${
                            sidebarTab === "SCANS"
                                ? "border-cyan-500 text-cyan-600 dark:text-cyan-400"
                                : "border-transparent text-slate-400 dark:text-slate-500 hover:text-slate-600"
                        }`}
                    >
                        SCANS ({history.length})
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                    {sidebarTab === "PATIENTS" ? (
                        <div className="space-y-3">
                            {mockPatientRecords.map((patient) => {
                                const isExpanded = selectedPatientId === patient.patientId;
                                return (
                                    <div 
                                        key={patient.patientId} 
                                        className="border border-slate-200 dark:border-slate-800 p-3 bg-slate-50/50 dark:bg-slate-950/20"
                                    >
                                        <div 
                                            onClick={() => setSelectedPatientId(isExpanded ? null : patient.patientId)}
                                            className="flex justify-between items-center cursor-pointer hover:text-cyan-500 dark:hover:text-cyan-400 transition-colors"
                                        >
                                            <div>
                                                <p className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200">Patient: {patient.patientId}</p>
                                                <p className="text-[9px] text-slate-400 font-mono mt-0.5">{patient.gender.toUpperCase()}, {patient.age} Y/O</p>
                                            </div>
                                            <span className="text-xs font-mono">{isExpanded ? "▲" : "▼"}</span>
                                        </div>

                                        {isExpanded && (
                                            <div className="mt-3 border-t border-slate-100 dark:border-slate-800/80 pt-2 space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
                                                {patient.scans.map((scan) => (
                                                    <div 
                                                        key={scan.scanId}
                                                        onClick={() => loadPatientScan(scan)}
                                                        className="p-2 bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 hover:border-cyan-500/50 dark:hover:border-cyan-400/50 cursor-pointer transition-all duration-150 hover:translate-x-1"
                                                    >
                                                        <div className="flex justify-between items-center text-[10px] font-mono">
                                                            <span className="font-bold text-slate-600 dark:text-slate-400">{scan.scanId}</span>
                                                            <span className="text-slate-400">{scan.date}</span>
                                                        </div>
                                                        <div className="flex justify-between items-center mt-2">
                                                            <span className={`px-1.5 py-0.2 text-[9px] font-mono font-bold rounded-none uppercase tracking-wider ${
                                                                scan.severity === 0 ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' :
                                                                scan.severity === 1 ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20' :
                                                                scan.severity === 2 ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20' :
                                                                'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20'
                                                            }`}>
                                                                {scan.severity === 0 ? 'Normal' :
                                                                 scan.severity === 1 ? 'Trace' :
                                                                 scan.severity === 2 ? 'Mild' : 'Severe'}
                                                            </span>
                                                            <span className="text-[9px] font-mono text-slate-400">{scan.confidence}% CONF</span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        history.length === 0 ? (
                            <p className="text-xs font-mono text-slate-400 text-center py-10">
                                NO RECENT SCANS
                            </p>
                        ) : (
                            history.map((item) => (
                                <div
                                    key={item.id}
                                    onClick={() => loadHistoryItem(item)}
                                    className="p-4 rounded-none bg-slate-50/50 dark:bg-slate-950/40 border border-slate-200/80 dark:border-slate-800/80 hover:border-cyan-500/50 dark:hover:border-cyan-400/50 hover:bg-white dark:hover:bg-slate-900 cursor-pointer transition-all duration-200 active:scale-[0.99] shadow-xs hover:shadow-[0_4px_16px_rgba(34,211,238,0.06)]"
                                >
                                    <div className="flex justify-between items-start gap-2 mb-2">
                                        <span className="text-xs font-mono font-bold truncate max-w-40 text-slate-800 dark:text-slate-200">
                                            {item.fileName}
                                        </span>
                                        <span className="text-[9px] font-mono text-slate-400 shrink-0 mt-0.5">
                                            {item.timestamp}
                                        </span>
                                    </div>

                                    <div className="flex justify-between items-center mt-3">
                                        <span className={`px-2 py-0.5 text-[9px] font-mono font-bold rounded-none uppercase tracking-wider ${
                                            item.severity === 0 ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' :
                                            item.severity === 1 ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20' :
                                            item.severity === 2 ? 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20' :
                                            'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20'
                                        }`}>
                                            {item.severity === 0 ? 'Normal' :
                                             item.severity === 1 ? 'Trace' :
                                             item.severity === 2 ? 'Mild' : 'Severe'}
                                        </span>
                                        <span className="text-[9px] font-mono text-slate-500 dark:text-slate-400 shrink-0">
                                            {item.responseTime}MS ON {item.hardware.toUpperCase()}
                                        </span>
                                    </div>
                                </div>
                            ))
                        )
                    )}
                </div>
            </div>

            {/* Sliding Drawer Backdrop Overlay */}
            {historyOpen && (
                <div 
                    onClick={() => setHistoryOpen(false)}
                    className="fixed inset-0 bg-slate-950/20 dark:bg-slate-950/50 backdrop-blur-xs z-30 transition-all duration-300"
                />
            )}

            {!diagnosis ? (
                <div className="w-full max-w-xl animate-in fade-in zoom-in-95 duration-300">
                    <FileUploadArea
                        onDataLoaded={handleAnalysis}
                        onError={(msg) => alert(msg)}
                    />
                    {loading && (
                        <p className="text-cyan-600 dark:text-cyan-400 mt-6 text-center animate-pulse font-mono tracking-widest text-sm">
                            ANALYZING SIGNAL...
                        </p>
                    )}
                </div>
            ) : (
                <div className="w-full max-w-6xl space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <DiagnosisDashboard
                        data={diagnosis}
                        darkMode={darkMode}
                        onReset={() => {
                            setDiagnosis(null);
                        }}
                    />
                </div>
            )}
        </div>
    );
}