import { useState, useEffect } from "react";
import type { DiagnosisData, BurdenTier, Patient } from "./types";
import DiagnosisDashboard from "./components/DiagnosisDashboard";
import FileUploadArea from "./components/FileUploadArea";

interface HistoryItem {
    id: string;
    fileName: string;
    timestamp: string;
    burdenTier: BurdenTier;
    confidence: number;
    burden: number;
    hardware: string;
    responseTime: number;
    rawSignal: number[];
    rPeaks?: number[];
    rrVariance?: number;
    rmssd?: number;
    gradCam?: number[];
    strokeRiskScore?: number;
    cumulativeAFibBurden?: number;
    patientId?: string;
}

export default function App() {
    const [diagnosis, setDiagnosis] = useState<DiagnosisData | null>(null);
    const [loading, setLoading] = useState(false);
    const [history, setHistory] = useState<HistoryItem[]>([]);

    // Patients Sidebar & Database States
    const [sidebarTab, setSidebarTab] = useState<"PATIENTS" | "SCANS">("PATIENTS");
    const [patients, setPatients] = useState<Patient[]>([]);
    const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
    const [selectedPatientScans, setSelectedPatientScans] = useState<any[]>([]);

    // Register Patient Panel
    const [isRegistering, setIsRegistering] = useState(false);
    const [tempSignal, setTempSignal] = useState<number[] | null>(null);
    const [tempFileName, setTempFileName] = useState<string>("");
    const [newPatient, setNewPatient] = useState({
        id: "",
        name: "",
        age: 65,
        gender: "male",
        hypertension: false,
        diabetes: false,
        stroke_history: false,
        vascular_disease: false,
        heart_failure: false,
    });

    const [previewId, setPreviewId] = useState("");

    // Scan Filter and Sorting
    const [scanFilter, setScanFilter] = useState<string>("ALL");
    const [scanSort, setScanSort] = useState<string>("NEWEST");

    const fetchNextId = async () => {
        try {
            const res = await fetch("http://localhost:8000/patients/next-id");
            if (res.ok) {
                const data = await res.json();
                setPreviewId(data.next_id);
            }
        } catch (err) {
            console.error("Error fetching next patient ID:", err);
        }
    };

    useEffect(() => {
        if (isRegistering) {
            fetchNextId();
        } else {
            setPreviewId("");
        }
    }, [isRegistering]);

    const fetchPatients = async () => {
        try {
            const res = await fetch("http://localhost:8000/patients");
            if (res.ok) {
                const data = await res.json();
                setPatients(data);
            }
        } catch (err) {
            console.error("Error fetching patients:", err);
        }
    };

    const fetchPatientHistory = async (patientId: string) => {
        try {
            const res = await fetch(`http://localhost:8000/patients/${encodeURIComponent(patientId)}/history`);
            if (res.ok) {
                const data = await res.json();
                setSelectedPatientScans(data);
            }
        } catch (err) {
            console.error("Error fetching patient scans:", err);
        }
    };

    useEffect(() => {
        fetchPatients();
    }, []);

    useEffect(() => {
        if (selectedPatientId) {
            fetchPatientHistory(selectedPatientId);
        } else {
            setSelectedPatientScans([]);
        }
    }, [selectedPatientId]);

    const registerPatient = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newPatient.name) return;
        try {
            // 1. Create Patient
            const response = await fetch("http://localhost:8000/patients", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    id: previewId,
                    name: newPatient.name,
                    age: Number(newPatient.age),
                    gender: newPatient.gender,
                    hypertension: newPatient.hypertension ? 1 : 0,
                    diabetes: newPatient.diabetes ? 1 : 0,
                    stroke_history: newPatient.stroke_history ? 1 : 0,
                    vascular_disease: newPatient.vascular_disease ? 1 : 0,
                    heart_failure: newPatient.heart_failure ? 1 : 0,
                })
            });
            if (response.ok) {
                await fetchPatients();
                
                // 2. Run prediction if signal was uploaded
                if (tempSignal) {
                    setSelectedPatientId(previewId);
                    await handleAnalysis(tempSignal, tempFileName, previewId);
                }
                
                // Reset states
                setIsRegistering(false);
                setTempSignal(null);
                setTempFileName("");
                setNewPatient({
                    id: "",
                    name: "",
                    age: 65,
                    gender: "male",
                    hypertension: false,
                    diabetes: false,
                    stroke_history: false,
                    vascular_disease: false,
                    heart_failure: false,
                });
            }
        } catch (err) {
            console.error("Error registering patient:", err);
        }
    };

    const handleAnalysis = async (incomingSignal: number[], fileName: string, overridePatientId?: string) => {
        setLoading(true);
        const startTime = performance.now();
        try {
            const patientIdToUse = overridePatientId || selectedPatientId;
            const payload: any = { signal: incomingSignal };
            if (patientIdToUse) {
                payload.patient_id = patientIdToUse;
            }

            const response = await fetch("http://localhost:8000/predict", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            const result = await response.json();
            const endTime = performance.now();

            const burdenTier: BurdenTier = (result.severity_class ?? 0) as BurdenTier;
            let simulatedBurden = 0.0;

            if (burdenTier === 1) simulatedBurden = 4.25;
            else if (burdenTier === 2) simulatedBurden = 28.4;
            else if (burdenTier === 3) simulatedBurden = 72.8;

            const responseTime = Math.round(endTime - startTime);
            const confidence = Math.round((result.confidence ?? 0.0) * 100.0);
            const burden = burdenTier === 0 ? 0.0 : simulatedBurden;

            const newDiagnosis: DiagnosisData = {
                burdenTier: burdenTier,
                confidence: confidence,
                burden: burden,
                hardware: result.hardware_used ?? "cpu",
                responseTime: responseTime,
                rawSignal: incomingSignal,
                rPeaks: result.r_peaks ?? [],
                rrVariance: result.rr_variance ?? 0.0,
                rmssd: result.rmssd ?? 0.0,
                gradCam: result.grad_cam ?? [],
                strokeRiskScore: result.stroke_risk_score,
                cumulativeAFibBurden: result.cumulative_burden,
                patientId: patientIdToUse || undefined
            };

            setDiagnosis(newDiagnosis);

            const historyItem: HistoryItem = {
                id: Math.random().toString(36).substring(2, 9),
                fileName: fileName || "ecg_signal.json",
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }),
                ...newDiagnosis
            };

            setHistory(prev => [historyItem, ...prev]);

            if (patientIdToUse) {
                fetchPatients();
                fetchPatientHistory(patientIdToUse);
            }
        } catch (error) {
            console.error("Inference Error:", error);
        } finally {
            setLoading(false);
        }
    };

    const loadHistoryItem = (item: HistoryItem) => {
        setDiagnosis({
            burdenTier: item.burdenTier,
            confidence: item.confidence,
            burden: item.burden,
            hardware: item.hardware,
            responseTime: item.responseTime,
            rawSignal: item.rawSignal,
            rPeaks: item.rPeaks,
            rrVariance: item.rrVariance,
            rmssd: item.rmssd,
            gradCam: item.gradCam,
            strokeRiskScore: item.strokeRiskScore,
            cumulativeAFibBurden: item.cumulativeAFibBurden,
            patientId: item.patientId
        });
    };

    const loadPatientScan = (scan: any) => {
        const tier = (scan.predicted_class ?? 0) as BurdenTier;
        let simulatedBurden = 0.0;
        if (tier === 1) simulatedBurden = 4.25;
        else if (tier === 2) simulatedBurden = 28.4;
        else if (tier === 3) simulatedBurden = 72.8;

        const currentPatient = patients.find(p => p.id === scan.patient_id);

        setDiagnosis({
            burdenTier: tier,
            confidence: Math.round((scan.confidence ?? 0.0) * 100.0),
            burden: tier === 0 ? 0.0 : simulatedBurden,
            hardware: "SQLite DB",
            responseTime: 0,
            rawSignal: typeof scan.signal_data === "string" ? JSON.parse(scan.signal_data) : (scan.signal_data ?? []),
            rPeaks: typeof scan.r_peaks === "string" ? JSON.parse(scan.r_peaks) : (scan.r_peaks ?? []), 
            rrVariance: scan.rr_variance ?? 0.0,
            rmssd: scan.rmssd ?? 0.0,
            gradCam: typeof scan.grad_cam === "string" ? JSON.parse(scan.grad_cam) : (scan.grad_cam ?? []),
            strokeRiskScore: currentPatient?.stroke_risk_score,
            cumulativeAFibBurden: currentPatient?.cumulative_burden,
            patientId: scan.patient_id
        });
    };

    return (
        <div className="min-h-screen flex text-text-primary bg-bg-canvas overflow-x-hidden">
            {/* Permanently Docked ECG Registry Sidebar */}
            <div className="w-80 shrink-0 bg-card-bg border-r border-border-subtle p-6 flex flex-col h-screen sticky top-0 overflow-y-auto z-10 shadow-md">
                <div className="flex justify-between items-center mb-4 pb-2 border-b border-border-subtle">
                    <h2 className="text-lg font-bold font-mono tracking-wide text-text-primary">ECG REGISTRY</h2>
                    <button 
                        onClick={() => setDiagnosis(null)}
                        className="text-[10px] font-mono font-bold px-2 py-1 bg-brand-primary/10 hover:bg-brand-primary/20 text-brand-primary border border-brand-primary/20 rounded-none cursor-pointer active:scale-95"
                    >
                        HELP
                    </button>
                </div>

                {/* Multi-Panel Tabs */}
                <div className="flex border-b border-border-subtle mb-4">
                    <button
                        onClick={() => setSidebarTab("PATIENTS")}
                        className={`flex-1 py-2 text-xs font-mono font-bold border-b-2 cursor-pointer transition-all ${
                            sidebarTab === "PATIENTS"
                                ? "border-brand-primary text-brand-primary font-black"
                                : "border-transparent text-brand-secondary hover:text-text-primary"
                        }`}
                    >
                        PATIENTS
                    </button>
                    <button
                        onClick={() => setSidebarTab("SCANS")}
                        className={`flex-1 py-2 text-xs font-mono font-bold border-b-2 cursor-pointer transition-all ${
                            sidebarTab === "SCANS"
                                ? "border-brand-primary text-brand-primary font-black"
                                : "border-transparent text-brand-secondary hover:text-text-primary"
                        }`}
                    >
                        SCANS ({history.length})
                    </button>
                </div>

                <div className="flex-1 space-y-3 pr-1">
                    {sidebarTab === "PATIENTS" ? (
                        <div className="space-y-3">
                            {/* New Patient Registration Trigger */}
                            <button
                                onClick={() => setIsRegistering(!isRegistering)}
                                className="w-full py-2 bg-brand-primary/10 text-brand-primary hover:bg-brand-primary/15 border border-brand-primary/20 text-[11px] font-mono font-bold transition-all cursor-pointer rounded-none active:scale-[0.98]"
                            >
                                {isRegistering ? "✕ CANCEL REGISTRATION" : "＋ REGISTER NEW PATIENT"}
                            </button>

                            {isRegistering && (
                                <form onSubmit={registerPatient} className="bg-bg-canvas p-3 border border-border-subtle space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
                                    <div>
                                        <label className="block text-[9px] font-mono text-brand-secondary uppercase">Patient ID</label>
                                        <div className="w-full bg-bg-canvas border border-border-subtle text-xs p-1.5 mt-0.5 rounded-none font-mono text-zinc-500 select-none">
                                            {previewId || "Fetching ID..."} <span className="opacity-60 italic text-[10px]">(Preview)</span>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-[9px] font-mono text-brand-secondary uppercase">Full Name *</label>
                                        <input
                                            type="text"
                                            required
                                            value={newPatient.name}
                                            onChange={e => setNewPatient(prev => ({ ...prev, name: e.target.value }))}
                                            className="w-full bg-card-bg border border-border-subtle text-xs p-1 mt-0.5 rounded-none font-mono"
                                            placeholder="John Doe"
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <label className="block text-[9px] font-mono text-brand-secondary uppercase">Age *</label>
                                            <input
                                                type="number"
                                                required
                                                value={newPatient.age === 0 ? "" : newPatient.age}
                                                onChange={e => {
                                                    const val = e.target.value;
                                                    setNewPatient(prev => ({ ...prev, age: val === "" ? "" as any : Number(val) }));
                                                }}
                                                className="w-full bg-card-bg border border-border-subtle text-xs p-1 mt-0.5 rounded-none font-mono"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[9px] font-mono text-brand-secondary uppercase">Gender *</label>
                                            <select
                                                value={newPatient.gender}
                                                onChange={e => setNewPatient(prev => ({ ...prev, gender: e.target.value }))}
                                                className="w-full bg-card-bg border border-border-subtle text-xs p-1 mt-0.5 rounded-none font-mono"
                                            >
                                                <option value="male">MALE</option>
                                                <option value="female">FEMALE</option>
                                            </select>
                                        </div>
                                    </div>

                                    {/* Comorbidities checkboxes */}
                                    <div className="border-t border-border-subtle pt-2 mt-1 space-y-1">
                                        <p className="text-[9px] font-mono text-brand-secondary uppercase font-bold">Comorbidities (CHA₂DS₂-VASc)</p>
                                        <label className="flex items-center gap-1.5 text-[10px] font-mono cursor-pointer">
                                            <input type="checkbox" checked={newPatient.heart_failure} onChange={e => setNewPatient(prev => ({ ...prev, heart_failure: e.target.checked }))} />
                                            Heart Failure (+1)
                                        </label>
                                        <label className="flex items-center gap-1.5 text-[10px] font-mono cursor-pointer">
                                            <input type="checkbox" checked={newPatient.hypertension} onChange={e => setNewPatient(prev => ({ ...prev, hypertension: e.target.checked }))} />
                                            Hypertension (+1)
                                        </label>
                                        <label className="flex items-center gap-1.5 text-[10px] font-mono cursor-pointer">
                                            <input type="checkbox" checked={newPatient.diabetes} onChange={e => setNewPatient(prev => ({ ...prev, diabetes: e.target.checked }))} />
                                            Diabetes (+1)
                                        </label>
                                        <label className="flex items-center gap-1.5 text-[10px] font-mono cursor-pointer">
                                            <input type="checkbox" checked={newPatient.stroke_history} onChange={e => setNewPatient(prev => ({ ...prev, stroke_history: e.target.checked }))} />
                                            Stroke / TIA (+2)
                                        </label>
                                        <label className="flex items-center gap-1.5 text-[10px] font-mono cursor-pointer">
                                            <input type="checkbox" checked={newPatient.vascular_disease} onChange={e => setNewPatient(prev => ({ ...prev, vascular_disease: e.target.checked }))} />
                                            Vascular Disease (+1)
                                        </label>
                                    </div>

                                    {/* File upload section inside patient creation */}
                                    <div className="border-t border-border-subtle pt-2 mt-1 space-y-1">
                                        <p className="text-[9px] font-mono text-brand-secondary uppercase font-bold">ECG Baseline Data (2,500 samples)</p>
                                        <FileUploadArea
                                            onDataLoaded={(signal, name) => {
                                                setTempSignal(signal);
                                                setTempFileName(name);
                                            }}
                                            onError={(msg) => alert(msg)}
                                        />
                                        {tempSignal && (
                                            <p className="text-[10px] text-status-healthy font-mono font-bold mt-1">
                                                ✓ ECG File Loaded: {tempFileName}
                                            </p>
                                        )}
                                    </div>

                                    <button
                                        type="submit"
                                        className="w-full py-2 bg-status-healthy text-white hover:bg-status-healthy/90 text-[10.5px] font-mono font-bold rounded-none cursor-pointer"
                                    >
                                        SUBMIT PROFILE & RUN ECG
                                    </button>
                                </form>
                            )}

                            {patients.map((patient) => {
                                const isExpanded = selectedPatientId === patient.id;
                                return (
                                    <div 
                                        key={patient.id} 
                                        className={`border transition-all p-3 ${
                                            isExpanded ? "border-brand-primary bg-bg-canvas" : "border-border-subtle bg-bg-canvas"
                                        }`}
                                    >
                                        <div 
                                            onClick={() => {
                                                const nextId = isExpanded ? null : patient.id;
                                                setSelectedPatientId(nextId);
                                                setDiagnosis(null); // close active scan log and focus on the newly selected patient
                                            }}
                                            className="flex justify-between items-center cursor-pointer hover:text-brand-primary transition-colors"
                                        >
                                            <div>
                                                <p className="text-xs font-mono font-bold text-zinc-500">Patient: {patient.id}</p>
                                                <p className="text-[10px] font-bold text-brand-primary">{patient.name}</p>
                                                <p className="text-[9px] text-brand-secondary font-mono mt-0.5">{patient.gender.toUpperCase()}, {patient.age} Y/O</p>
                                            </div>
                                            <span className="text-xs font-mono">{isExpanded ? "▲" : "▼"}</span>
                                        </div>

                                        {isExpanded && (
                                            <div className="mt-3 border-t border-border-subtle pt-2 space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
                                                {/* Clinical Summary snippet in patient registry */}
                                                <div className="p-2 bg-bg-canvas/50 border border-border-subtle font-mono text-[9px] text-brand-secondary space-y-1">
                                                    <div>STROKE RISK: <span className="font-bold text-brand-primary">{patient.stroke_risk_score} PTS</span></div>
                                                    <div>CUMULATIVE BURDEN: <span className="font-bold text-status-critical">{patient.cumulative_burden ?? 0.0}%</span></div>
                                                </div>

                                                <p className="text-[9px] font-mono font-bold text-brand-secondary uppercase mt-2">Scan Logs:</p>
                                                {selectedPatientScans.length === 0 ? (
                                                    <p className="text-[9px] font-mono text-brand-secondary/60 text-center py-2">NO UPLOADED SCANS</p>
                                                ) : (
                                                    selectedPatientScans.map((scan) => (
                                                        <div 
                                                            key={scan.id}
                                                            onClick={() => loadPatientScan(scan)}
                                                            className="p-2 bg-card-bg border border-border-subtle hover:border-brand-primary/50 cursor-pointer transition-all duration-150 hover:translate-x-1"
                                                        >
                                                            <div className="flex justify-between items-center text-[10px] font-mono">
                                                                <span className="font-bold text-brand-secondary">Scan #{scan.id}</span>
                                                                <span className="text-brand-secondary/60 text-[8px]">{scan.timestamp.split(" ")[0]}</span>
                                                            </div>
                                                            <div className="flex justify-between items-center mt-2">
                                                                <span className={`px-1.5 py-0.2 text-[8px] font-mono font-bold rounded-none uppercase tracking-wider ${
                                                                    scan.predicted_class === 0 ? 'bg-status-healthy/10 text-status-healthy border border-status-healthy/20' :
                                                                    scan.predicted_class === 1 ? 'bg-status-info/10 text-status-info border border-status-info/20' :
                                                                    scan.predicted_class === 2 ? 'bg-status-warning/10 text-status-warning border border-status-warning/20' :
                                                                    'bg-status-critical/10 text-status-critical border border-status-critical/20'
                                                                }`}>
                                                                    {scan.predicted_class === 0 ? 'Sinus Rhythm' :
                                                                     scan.predicted_class === 1 ? 'Micro' :
                                                                     scan.predicted_class === 2 ? 'Intermed.' : 'High'}
                                                                </span>
                                                                <span className="text-[9px] font-mono text-brand-secondary/80">{Math.round(scan.confidence * 100)}% CONF</span>
                                                            </div>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {/* Filter and Sort Toolbar */}
                            <div className="grid grid-cols-2 gap-2 pb-3 border-b border-border-subtle/50 mb-2">
                                <div>
                                    <label className="block text-[8px] font-mono text-brand-secondary uppercase mb-0.5">Filter Type</label>
                                    <select
                                        value={scanFilter}
                                        onChange={e => setScanFilter(e.target.value)}
                                        className="w-full bg-bg-canvas border border-border-subtle text-[9px] p-1 rounded-none font-mono text-text-primary cursor-pointer font-bold"
                                    >
                                        <option value="ALL">ALL TYPES</option>
                                        <option value="0">SINUS RHYTHM</option>
                                        <option value="1">MICRO-BURDEN</option>
                                        <option value="2">INTERMEDIATE</option>
                                        <option value="3">HIGH BURDEN</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-[8px] font-mono text-brand-secondary uppercase mb-0.5">Arrange By</label>
                                    <select
                                        value={scanSort}
                                        onChange={e => setScanSort(e.target.value)}
                                        className="w-full bg-bg-canvas border border-border-subtle text-[9px] p-1 rounded-none font-mono text-text-primary cursor-pointer font-bold"
                                    >
                                        <option value="NEWEST">NEWEST FIRST</option>
                                        <option value="OLDEST">OLDEST FIRST</option>
                                        <option value="TYPE_ASC">TYPE (LOW→HIGH)</option>
                                        <option value="TYPE_DESC">TYPE (HIGH→LOW)</option>
                                    </select>
                                </div>
                            </div>

                            {(() => {
                                // 1. Filter
                                let filtered = [...history];
                                if (scanFilter !== "ALL") {
                                    const tierNum = Number(scanFilter);
                                    filtered = filtered.filter(item => item.burdenTier === tierNum);
                                }

                                // 2. Sort/Arrange
                                filtered.sort((a, b) => {
                                    if (scanSort === "NEWEST") {
                                        return b.timestamp.localeCompare(a.timestamp);
                                    }
                                    if (scanSort === "OLDEST") {
                                        return a.timestamp.localeCompare(b.timestamp);
                                    }
                                    if (scanSort === "TYPE_ASC") {
                                        return a.burdenTier - b.burdenTier;
                                    }
                                    if (scanSort === "TYPE_DESC") {
                                        return b.burdenTier - a.burdenTier;
                                    }
                                    return 0;
                                });

                                if (filtered.length === 0) {
                                    return (
                                        <p className="text-xs font-mono text-brand-secondary text-center py-10">
                                            NO MATCHING SCANS
                                        </p>
                                    );
                                }

                                return filtered.map((item) => (
                                    <div
                                        key={item.id}
                                        onClick={() => loadHistoryItem(item)}
                                        className="p-4 rounded-none bg-bg-canvas border border-border-subtle hover:border-brand-primary/50 hover:bg-card-bg cursor-pointer transition-all duration-200 active:scale-[0.99] shadow-xs hover:shadow-[0_4px_16px_rgba(0,102,204,0.06)]"
                                    >
                                        <div className="flex justify-between items-start gap-2 mb-2">
                                            <span className="text-xs font-mono font-bold truncate max-w-40 text-text-primary">
                                                {item.fileName}
                                            </span>
                                            <span className="text-[9px] font-mono text-brand-secondary/60 shrink-0 mt-0.5">
                                                {item.timestamp}
                                            </span>
                                        </div>

                                        <div className="flex justify-between items-center mt-3">
                                            <span className={`px-2 py-0.5 text-[9px] font-mono font-bold rounded-none uppercase tracking-wider ${
                                                item.burdenTier === 0 ? 'bg-status-healthy/10 text-status-healthy border border-status-healthy/20' :
                                                item.burdenTier === 1 ? 'bg-status-info/10 text-status-info border border-status-info/20' :
                                                item.burdenTier === 2 ? 'bg-status-warning/10 text-status-warning border border-status-warning/20' :
                                                'bg-status-critical/10 text-status-critical border border-status-critical/20'
                                            }`}>
                                                {item.burdenTier === 0 ? 'Sinus Rhythm' :
                                                 item.burdenTier === 1 ? 'Micro' :
                                                 item.burdenTier === 2 ? 'Intermed.' : 'High'}
                                            </span>
                                            <span className="text-[9px] font-mono text-brand-secondary shrink-0">
                                                {item.responseTime}MS ON {item.hardware.toUpperCase()}
                                            </span>
                                        </div>
                                    </div>
                                ));
                            })()}
                        </div>
                    )}
                </div>
            </div>

            {/* Main Content Pane */}
            <div className="flex-1 flex flex-col p-6 min-w-0 overflow-y-auto">
                {!diagnosis ? (
                    selectedPatientId ? (
                        <div className="w-full flex-1 flex flex-col animate-in fade-in duration-300">
                            <div className="flex-1 border border-border-subtle p-8 bg-card-bg shadow-sm flex flex-col justify-center items-center space-y-6">
                                <div className="text-center space-y-2">
                                    <p className="text-xs font-mono text-brand-secondary uppercase tracking-widest">Active Patient Target</p>
                                    <h2 className="text-3xl font-bold tracking-wide text-brand-primary">
                                        {patients.find(p => p.id === selectedPatientId)?.name} ({selectedPatientId})
                                    </h2>
                                    <p className="text-sm text-brand-secondary font-mono">
                                        Upload a new ECG signal to append to this patient's historical registry.
                                    </p>
                                </div>
                                
                                <div className="w-full max-w-md border border-border-subtle p-6 bg-bg-canvas/50">
                                    <FileUploadArea
                                        onDataLoaded={(signal, name) => handleAnalysis(signal, name, selectedPatientId)}
                                        onError={(msg) => alert(msg)}
                                    />
                                </div>
                            </div>
                            {loading && (
                                <p className="text-brand-primary mt-6 text-center animate-pulse font-mono tracking-widest text-sm shrink-0">
                                    ANALYZING SIGNAL...
                                </p>
                            )}
                        </div>
                    ) : (
                        <div className="w-full flex-1 flex flex-col animate-in fade-in duration-300">
                            <div className="flex-1 border border-border-subtle p-8 bg-card-bg shadow-sm flex flex-col justify-center items-center space-y-6">
                                <div className="w-16 h-16 bg-brand-primary/10 border border-brand-primary/20 rounded-none flex items-center justify-center mx-auto text-brand-primary text-xl font-bold font-mono">
                                    ECG
                                </div>
                                <div className="text-center space-y-2">
                                    <h2 className="text-3xl font-bold tracking-wide">CARDIAC CDSS WORKSTATION</h2>
                                    <p className="text-sm text-brand-secondary font-mono">
                                        Atrial Fibrillation Temporal Burden & Stroke Risk Calculator.
                                    </p>
                                </div>
                                <div className="border-t border-border-subtle pt-6 w-full max-w-lg text-center text-xs font-mono text-brand-secondary space-y-3">
                                    <p className="font-bold text-text-primary uppercase tracking-wider mb-2">Instructions to begin analysis:</p>
                                    <p>1. Register a new patient profile using the sidebar form.</p>
                                    <p>2. Upload their raw ECG signal file to initialize analysis.</p>
                                    <p>3. Select any registered patient to view their historical longitudinal trend.</p>
                                </div>
                            </div>
                            {loading && (
                                <p className="text-brand-primary mt-6 text-center animate-pulse font-mono tracking-widest text-sm shrink-0">
                                    ANALYZING SIGNAL...
                                </p>
                            )}
                        </div>
                    )
                ) : (
                    <div className="w-full space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="bg-card-bg border border-border-subtle p-4 flex justify-between items-center gap-4 flex-wrap shadow-xs">
                            {selectedPatientId ? (
                                <>
                                    <div>
                                        <p className="text-xs font-mono text-brand-secondary uppercase">Active Patient Target</p>
                                        <p className="text-lg font-bold text-brand-primary">
                                            {patients.find(p => p.id === selectedPatientId)?.name} ({selectedPatientId})
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => setSelectedPatientId(null)}
                                        className="px-4 py-2 bg-bg-canvas hover:bg-border-subtle border border-border-subtle text-xs font-mono font-bold cursor-pointer rounded-none"
                                    >
                                        DESELECT
                                    </button>
                                </>
                            ) : (
                                <div>
                                    <p className="text-xs font-mono text-brand-secondary uppercase">Active Patient Target</p>
                                    <p className="text-sm font-bold text-zinc-500 italic font-mono">
                                        No patient target selected (Anonymous Scan Mode)
                                    </p>
                                </div>
                            )}
                        </div>
                        
                        <DiagnosisDashboard
                            data={diagnosis}
                            patientScans={selectedPatientId ? selectedPatientScans : undefined}
                            activePatient={selectedPatientId ? patients.find(p => p.id === selectedPatientId) : undefined}
                            onReset={() => {
                                setDiagnosis(null);
                            }}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}