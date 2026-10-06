import { useState, useEffect } from "react";
import type { DiagnosisData, BurdenTier, Patient } from "./types";
import { parseJson } from "./tiers";
import DiagnosisDashboard from "./components/DiagnosisDashboard";
import FileUploadArea from "./components/FileUploadArea";
import Sidebar from "./components/Sidebar";
import type { HistoryItem } from "./components/ScanHistory";
import ECGSimulatorPanel from "./components/ECGSimulatorPanel";

// Real 10 s strips from test-split patients (ml_pipeline/export_real_samples.py), loaded on demand
const sampleFiles = import.meta.glob<{ signal: number[] }>("../../test/real_*.json", { import: "default" });
const SAMPLES = [
    ["sinus", "Normal rhythm"],
    ["paroxysm", "AFib starting mid-strip"],
    ["afib", "AFib throughout"],
] as const;

export default function App() {
    const [diagnosis, setDiagnosis] = useState<DiagnosisData | null>(null);
    const [loading, setLoading] = useState(false);
    const [analysisError, setAnalysisError] = useState<string | null>(null);
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

    const [entryTab, setEntryTab] = useState<"UPLOAD" | "SIMULATE">("UPLOAD");

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
                const data: Patient[] = await res.json();
                setPatients(data.filter(p => p.id !== "#0000-0")); // internal profile for anonymous scans
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
                            burden: scan.afib_burden ?? null,
                            hardware: "SQLite DB",
                            responseTime: 0,
                            rawSignal: parseJson(scan.signal_data, []),
                            rPeaks: parseJson(scan.r_peaks, []),
                            rrVariance: scan.rr_variance ?? 0.0,
                            rmssd: scan.rmssd ?? 0.0,
                            gradCam: parseJson(scan.grad_cam, []),
                            windowProbs: parseJson(scan.window_probs, undefined),
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

                        return {
                            ...prev,
                            burdenTier: newClass as BurdenTier
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
        setAnalysisError(null);
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
            if (!response.ok) throw new Error(result.detail ?? `The server answered ${response.status}.`);
            const endTime = performance.now();

            const burdenTier: BurdenTier = (result.severity_class ?? 0) as BurdenTier;

            const responseTime = Math.round(endTime - startTime);
            const confidence = Math.round((result.confidence ?? 0.0) * 100.0);
            const burden = result.afib_burden ?? 0.0;

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
                windowProbs: result.window_afib_probs,
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
            setAnalysisError(error instanceof TypeError
                ? "Couldn't reach the analysis server. Start it with ./start.sh, or uvicorn on port 8000."
                : `The strip couldn't be analyzed: ${(error as Error).message}`);
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
            windowProbs: item.windowProbs,
            strokeRiskScore: item.strokeRiskScore,
            cumulativeAFibBurden: item.cumulativeAFibBurden,
            patientId: item.patientId
        });
    };

    const loadPatientScan = (scan: any) => {
        const tier = (scan.predicted_class ?? 0) as BurdenTier;

        const currentPatient = patients.find(p => p.id === scan.patient_id);

        setDiagnosis({
            id: Number(scan.id),
            burdenTier: tier,
            confidence: Math.round((scan.confidence ?? 0.0) * 100.0),
            burden: scan.afib_burden ?? null,
            hardware: "SQLite DB",
            responseTime: 0,
            rawSignal: parseJson(scan.signal_data, []),
            rPeaks: parseJson(scan.r_peaks, []),
            rrVariance: scan.rr_variance ?? 0.0,
            rmssd: scan.rmssd ?? 0.0,
            gradCam: parseJson(scan.grad_cam, []),
            windowProbs: parseJson(scan.window_probs, undefined),
            strokeRiskScore: currentPatient?.stroke_risk_score,
            cumulativeAFibBurden: currentPatient?.cumulative_burden,
            patientId: scan.patient_id
        });
    };

    return (
        <div className="flex min-h-screen flex-col overflow-x-hidden lg:flex-row">
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

            <main className="min-w-0 flex-1 overflow-y-auto px-5 py-6 sm:px-8 sm:py-8">
                <div className="mx-auto max-w-6xl">
                    {diagnosis ? (
                        <DiagnosisDashboard
                            data={diagnosis}
                            patientScans={selectedPatientId ? selectedPatientScans : undefined}
                            activePatient={selectedPatientId ? patients.find(p => p.id === selectedPatientId) : undefined}
                            onReset={() => setDiagnosis(null)}
                            onUpdateScan={updateScan}
                        />
                    ) : (
                        <StartScreen
                            patient={patients.find(p => p.id === selectedPatientId)}
                            entryTab={entryTab}
                            setEntryTab={setEntryTab}
                            loading={loading}
                            error={analysisError}
                            onAnalyze={(signal, name, demographics) => handleAnalysis(signal, name, selectedPatientId ?? undefined, demographics)}
                        />
                    )}
                </div>
            </main>
        </div>
    );
}
interface StartScreenProps {
    patient?: Patient;
    entryTab: "UPLOAD" | "SIMULATE";
    setEntryTab: (tab: "UPLOAD" | "SIMULATE") => void;
    loading: boolean;
    error: string | null;
    onAnalyze: (signal: number[], fileName: string, demographics?: any) => void;
}

function StartScreen({ patient, entryTab, setEntryTab, loading, error, onAnalyze }: StartScreenProps) {
    const loadSample = async (key: string) => {
        const load = sampleFiles[`../../test/real_${key}.json`];
        if (load) onAnalyze((await load()).signal, `real_${key}.json`);
    };

    return (
        <section className="space-y-6">
            <header className="max-w-2xl">
                <h1 className="figure text-4xl sm:text-5xl">{patient ? patient.name : "Measure AFib burden from a 10-second ECG"}</h1>
                <p className="mt-3 text-lg text-ink-soft">
                    {patient
                        ? `New recording for ${patient.id}. The scan is saved to their record.`
                        : "The model checks every 2 seconds of the strip for atrial fibrillation and reports how much of it is in AFib."}
                </p>
            </header>

            <div className="relative rounded-xl border border-line bg-sheet p-6">
                <div className="mb-5 flex gap-5 border-b border-line" role="tablist">
                    {([["UPLOAD", "Upload a strip"], ["SIMULATE", "Simulate one"]] as const).map(([value, label]) => (
                        <button
                            key={value}
                            role="tab"
                            aria-selected={entryTab === value}
                            onClick={() => setEntryTab(value)}
                            className={`-mb-px border-b-2 bg-transparent pb-2.5 font-medium transition-colors ${
                                entryTab === value ? "border-ink text-ink" : "border-transparent text-ink-soft hover:text-ink"
                            }`}
                        >
                            {label}
                        </button>
                    ))}
                </div>

                {entryTab === "UPLOAD" ? (
                    <div className="space-y-5">
                        <FileUploadArea onDataLoaded={(signal, name) => onAnalyze(signal, name)} onError={msg => alert(msg)} />
                        {Object.keys(sampleFiles).length > 0 && (
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="mr-1 text-sm text-ink-soft">Or try a real strip from a patient the model never trained on:</span>
                                {SAMPLES.map(([key, label]) => (
                                    <button key={key} onClick={() => loadSample(key)} disabled={loading}
                                        className="rounded-full border border-line px-3 py-1 text-sm hover:border-ink disabled:opacity-50">
                                        {label}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                ) : (
                    <ECGSimulatorPanel onAnalyze={onAnalyze} patientName={patient?.name} />
                )}

                {loading && (
                    <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-sheet/85" role="status">
                        <p className="text-lg font-medium">Analyzing the strip…</p>
                    </div>
                )}
            </div>

            {error && <p className="rounded-lg border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger" role="alert">{error}</p>}

            {!patient && (
                <p className="max-w-2xl text-sm text-ink-soft">
                    To follow someone over time, register them in the sidebar. Their scans then build a burden trend and a stroke risk score.
                </p>
            )}
        </section>
    );
}
