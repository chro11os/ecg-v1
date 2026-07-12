import { useState, useEffect } from "react";
import type { DiagnosisData, BurdenTier, Patient } from "./types";
import DiagnosisDashboard from "./components/DiagnosisDashboard";
import FileUploadArea from "./components/FileUploadArea";
import Sidebar from "./components/Sidebar";
import type { HistoryItem } from "./components/ScanHistory";
import ECGSimulatorPanel from "./components/ECGSimulatorPanel";

export default function App() {
    const [diagnosis, setDiagnosis] = useState<DiagnosisData | null>(null);
    const [loading, setLoading] = useState(false);
    const [realHistory, setRealHistory] = useState<HistoryItem[]>([]);
    const [simulatedHistory, setSimulatedHistory] = useState<HistoryItem[]>([]);
    const [scanSource, setScanSource] = useState<"real" | "simulated">("real");

    // Patients Sidebar & Database States
    const [sidebarTab, setSidebarTab] = useState<"PATIENTS" | "SCANS">("PATIENTS");
    const [patients, setPatients] = useState<Patient[]>([]);
    const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
    const [selectedPatientScans, setSelectedPatientScans] = useState<any[]>([]);
    const [patientSearch, setPatientSearch] = useState("");
    const [patientSort, setPatientSort] = useState<string>("ID_ASC");
    const [patientScanSort, setPatientScanSort] = useState<string>("NEWEST");

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
    const [editingPatientId, setEditingPatientId] = useState<string | null>(null);

    // Scan Filter and Sorting
    const [scanFilter, setScanFilter] = useState<string>("ALL");
    const [scanSort, setScanSort] = useState<string>("NEWEST");

    // Workstation & Simulator Tabs
    const [activeWorkstationTab, setActiveWorkstationTab] = useState<"UPLOAD" | "SIMULATE">("UPLOAD");
    const [anonymousTab, setAnonymousTab] = useState<"INFO" | "SIMULATE">("INFO");

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

    const fetchRecentScans = async () => {
        try {
            const res = await fetch("http://localhost:8000/scans");
            if (res.ok) {
                const data = await res.json();
                const mapped: HistoryItem[] = data
                    .filter((scan: any) => scan.patient_id !== "#0000-0")
                    .map((scan: any) => {
                        const tier = (scan.predicted_class ?? 0) as BurdenTier;
                        let simulatedBurden = 0.0;
                        if (tier === 1) simulatedBurden = 4.25;
                        else if (tier === 2) simulatedBurden = 28.4;
                        else if (tier === 3) simulatedBurden = 72.8;

                        // Safe date parsing to prevent Safari/V8 crash
                        let timeStr = "";
                        if (scan.timestamp) {
                            const formatted = scan.timestamp.includes(" ") ? scan.timestamp.replace(" ", "T") : scan.timestamp;
                            const d = new Date(formatted);
                            timeStr = isNaN(d.getTime())
                                ? scan.timestamp
                                : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
                        }

                        return {
                            id: String(scan.id),
                            fileName: scan.patient_name ? `${scan.patient_name}_scan_${scan.id}.json` : `patient_scan_${scan.id}.json`,
                            timestamp: timeStr,
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
                            strokeRiskScore: 0, 
                            cumulativeAFibBurden: 0.0,
                            patientId: scan.patient_id
                        };
                    });
                setRealHistory(mapped);
            }
        } catch (err) {
            console.error("Error fetching recent scans:", err);
        }
    };

    useEffect(() => {
        fetchPatients();
        fetchRecentScans();
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
            const url = editingPatientId 
                ? `http://localhost:8000/patients/${encodeURIComponent(editingPatientId)}`
                : "http://localhost:8000/patients";
            const method = editingPatientId ? "PUT" : "POST";
            
            // 1. Create or Update Patient
            const response = await fetch(url, {
                method: method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    id: editingPatientId ? editingPatientId : previewId,
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
                
                // 2. Run prediction if signal was uploaded (only relevant for new registrations)
                if (!editingPatientId && tempSignal) {
                    setSelectedPatientId(previewId);
                    await handleAnalysis(tempSignal, tempFileName, previewId);
                }
                
                // Reset states
                setIsRegistering(false);
                setEditingPatientId(null);
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
            console.error("Error saving patient:", err);
        }
    };

    const deletePatient = async (patientId: string) => {
        if (!window.confirm(`Are you sure you want to delete patient ${patientId}? This will delete all their ECG scan history.`)) {
            return;
        }
        try {
            const res = await fetch(`http://localhost:8000/patients/${encodeURIComponent(patientId)}`, {
                method: "DELETE",
            });
            if (res.ok) {
                await fetchPatients();
                if (selectedPatientId === patientId) {
                    setSelectedPatientId(null);
                    setDiagnosis(null);
                }
            } else {
                const errData = await res.json();
                alert(`Error deleting patient: ${errData.detail}`);
            }
        } catch (err) {
            console.error("Error deleting patient:", err);
        }
    };

    const deleteScan = async (scanId: number, patientId: string) => {
        if (!window.confirm(`Are you sure you want to delete scan record #${scanId}?`)) {
            return;
        }
        try {
            const res = await fetch(`http://localhost:8000/scans/${scanId}`, {
                method: "DELETE",
            });
            if (res.ok) {
                await fetchRecentScans();
                if (patientId) {
                    await fetchPatientHistory(patientId);
                }
                await fetchPatients(); // update cumulative stats on patient card
                if (diagnosis && diagnosis.id === scanId) {
                    setDiagnosis(null);
                }
            } else {
                const errData = await res.json();
                alert(`Error deleting scan: ${errData.detail}`);
            }
        } catch (err) {
            console.error("Error deleting scan:", err);
        }
    };

    const updateScan = async (scanId: number, newClass: number, patientId: string) => {
        try {
            const res = await fetch(`http://localhost:8000/scans/${scanId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ predicted_class: newClass })
            });
            if (res.ok) {
                await fetchPatients();
                await fetchRecentScans();
                if (patientId) {
                    await fetchPatientHistory(patientId);
                }
                
                // Update active diagnosis view locally
                setDiagnosis(prev => {
                    if (prev && prev.id === scanId) {
                        let simulatedBurden = 0.0;
                        if (newClass === 1) simulatedBurden = 4.25;
                        else if (newClass === 2) simulatedBurden = 28.4;
                        else if (newClass === 3) simulatedBurden = 72.8;

                        return {
                            ...prev,
                            burdenTier: newClass as BurdenTier,
                            burden: newClass === 0 ? 0.0 : simulatedBurden
                        };
                    }
                    return prev;
                });
            } else {
                const errData = await res.json();
                alert(`Error updating scan: ${errData.detail}`);
            }
        } catch (err) {
            console.error("Error updating scan:", err);
        }
    };

    const startEditingPatient = (patient: Patient) => {
        setEditingPatientId(patient.id);
        setIsRegistering(true);
        setNewPatient({
            id: patient.id,
            name: patient.name,
            age: patient.age,
            gender: patient.gender,
            hypertension: patient.hypertension === 1,
            diabetes: patient.diabetes === 1,
            stroke_history: patient.stroke_history === 1,
            vascular_disease: patient.vascular_disease === 1,
            heart_failure: patient.heart_failure === 1,
        });
    };

    const handleAnalysis = async (incomingSignal: number[], fileName: string, overridePatientId?: string, simDemographics?: any) => {
        setLoading(true);
        const startTime = performance.now();
        try {
            const patientIdToUse = overridePatientId || selectedPatientId;

            // If anonymous scan and simulator demographics are provided, update #0000-0 profile first!
            if (!patientIdToUse && simDemographics) {
                try {
                    await fetch("http://localhost:8000/patients/#0000-0", {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            name: "Anonymous Scan Profile",
                            age: simDemographics.age,
                            gender: simDemographics.gender,
                            hypertension: simDemographics.hypertension ? 1 : 0,
                            diabetes: simDemographics.diabetes ? 1 : 0,
                            stroke_history: simDemographics.stroke_history ? 1 : 0,
                            vascular_disease: simDemographics.vascular_disease ? 1 : 0,
                            heart_failure: simDemographics.heart_failure ? 1 : 0,
                            picture_url: ""
                        })
                    });
                } catch (updateErr) {
                    console.error("Error updating anonymous profile demographics:", updateErr);
                }
            }

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
                id: result.scan_id ? Number(result.scan_id) : undefined,
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

            const { id: _, ...diagnosisWithoutId } = newDiagnosis;
            const historyItem: HistoryItem = {
                id: result.scan_id ? String(result.scan_id) : Math.random().toString(36).substring(2, 9),
                fileName: fileName || "ecg_signal.json",
                timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }),
                ...diagnosisWithoutId
            };

            if (fileName.startsWith("simulated_")) {
                setSimulatedHistory(prev => [historyItem, ...prev]);
            } else {
                setRealHistory(prev => [historyItem, ...prev]);
            }

            fetchPatients();
            fetchRecentScans();
            if (patientIdToUse) {
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
            id: Number(item.id) ? Number(item.id) : undefined,
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
            id: Number(scan.id),
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
            <Sidebar
                setDiagnosis={setDiagnosis}
                sidebarTab={sidebarTab}
                setSidebarTab={setSidebarTab}
                isRegistering={isRegistering}
                setIsRegistering={setIsRegistering}
                editingPatientId={editingPatientId}
                setEditingPatientId={setEditingPatientId}
                newPatient={newPatient}
                setNewPatient={setNewPatient}
                registerPatient={registerPatient}
                previewId={previewId}
                tempSignal={tempSignal}
                tempFileName={tempFileName}
                setTempSignal={setTempSignal}
                setTempFileName={setTempFileName}
                patientSearch={patientSearch}
                setPatientSearch={setPatientSearch}
                patientSort={patientSort}
                setPatientSort={setPatientSort}
                patientScanSort={patientScanSort}
                setPatientScanSort={setPatientScanSort}
                patients={patients}
                selectedPatientId={selectedPatientId}
                setSelectedPatientId={setSelectedPatientId}
                selectedPatientScans={selectedPatientScans}
                startEditingPatient={startEditingPatient}
                deletePatient={deletePatient}
                deleteScan={deleteScan}
                loadPatientScan={loadPatientScan}
                realHistory={realHistory}
                simulatedHistory={simulatedHistory}
                scanSource={scanSource}
                setScanSource={setScanSource}
                scanFilter={scanFilter}
                setScanFilter={setScanFilter}
                scanSort={scanSort}
                setScanSort={setScanSort}
                loadHistoryItem={loadHistoryItem}
            />

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
                                        Upload or simulate a new ECG signal to append to this patient's historical registry.
                                    </p>
                                </div>

                                <div className="flex border border-border-subtle p-0.5 bg-bg-canvas w-full max-w-md">
                                    <button
                                        onClick={() => setActiveWorkstationTab("UPLOAD")}
                                        className={`flex-1 py-1.5 text-xs font-mono font-bold transition-all cursor-pointer ${
                                            activeWorkstationTab === "UPLOAD"
                                                ? "bg-card-bg text-brand-primary shadow-xs"
                                                : "text-brand-secondary hover:text-text-primary"
                                        }`}
                                    >
                                        UPLOAD FILE
                                    </button>
                                    <button
                                        onClick={() => setActiveWorkstationTab("SIMULATE")}
                                        className={`flex-1 py-1.5 text-xs font-mono font-bold transition-all cursor-pointer ${
                                            activeWorkstationTab === "SIMULATE"
                                                ? "bg-card-bg text-brand-primary shadow-xs"
                                                : "text-brand-secondary hover:text-text-primary"
                                        }`}
                                    >
                                        RUN SIMULATION
                                    </button>
                                </div>
                                
                                <div className="w-full max-w-2xl border border-border-subtle p-6 bg-bg-canvas-card">
                                    {activeWorkstationTab === "UPLOAD" ? (
                                        <FileUploadArea
                                            onDataLoaded={(signal, name) => handleAnalysis(signal, name, selectedPatientId)}
                                            onError={(msg) => alert(msg)}
                                        />
                                    ) : (
                                        <ECGSimulatorPanel
                                            onAnalyze={(signal, name, simDemographics) => handleAnalysis(signal, name, selectedPatientId, simDemographics)}
                                            patientName={patients.find(p => p.id === selectedPatientId)?.name}
                                        />
                                    )}
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
                                <img 
                                    src="https://upload.wikimedia.org/wikipedia/en/f/f8/Mapua_Uni_logo.svg" 
                                    alt="Mapúa University Logo" 
                                    className="w-20 h-20 object-contain mx-auto select-none pointer-events-none"
                                />
                                <div className="text-center space-y-2">
                                    <h2 className="text-3xl font-bold tracking-wide uppercase">GTT - AFib Detection & Assessment Tool</h2>
                                    <p className="text-sm text-brand-secondary font-mono">
                                        Atrial Fibrillation Temporal Burden & Stroke Risk Calculator.
                                    </p>
                                </div>

                                <div className="flex border border-border-subtle p-0.5 bg-bg-canvas w-full max-w-md">
                                    <button
                                        onClick={() => setAnonymousTab("INFO")}
                                        className={`flex-1 py-1.5 text-xs font-mono font-bold transition-all cursor-pointer ${
                                            anonymousTab === "INFO"
                                                ? "bg-card-bg text-brand-primary shadow-xs"
                                                : "text-brand-secondary hover:text-text-primary"
                                        }`}
                                    >
                                        INSTRUCTIONS
                                    </button>
                                    <button
                                        onClick={() => setAnonymousTab("SIMULATE")}
                                        className={`flex-1 py-1.5 text-xs font-mono font-bold transition-all cursor-pointer ${
                                            anonymousTab === "SIMULATE"
                                                ? "bg-card-bg text-brand-primary shadow-xs"
                                                : "text-brand-secondary hover:text-text-primary"
                                        }`}
                                    >
                                        SIMULATE ECG (ANONYMOUS)
                                    </button>
                                </div>

                                {anonymousTab === "INFO" ? (
                                    <div className="border-t border-border-subtle pt-6 w-full max-w-lg text-center text-xs font-mono text-brand-secondary space-y-3">
                                        <p className="font-bold text-text-primary uppercase tracking-wider mb-2">Instructions to begin analysis:</p>
                                        <p>1. Register a new patient profile using the sidebar form.</p>
                                        <p>2. Upload their raw ECG signal file to initialize analysis.</p>
                                        <p>3. Select any registered patient to view their historical longitudinal trend.</p>
                                    </div>
                                ) : (
                                    <div className="w-full max-w-2xl border border-border-subtle p-6 bg-bg-canvas-card">
                                        <ECGSimulatorPanel
                                            onAnalyze={(signal, name) => handleAnalysis(signal, name)}
                                        />
                                    </div>
                                )}
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
                            onUpdateScan={updateScan}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}