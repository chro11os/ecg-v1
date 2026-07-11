import type { Patient } from "../types";
import PatientForm from "./PatientForm";
import PatientList from "./PatientList";
import ScanHistory from "./ScanHistory";
import type { HistoryItem } from "./ScanHistory";

interface SidebarProps {
    setDiagnosis: (diag: any) => void;
    sidebarTab: "PATIENTS" | "SCANS";
    setSidebarTab: (tab: "PATIENTS" | "SCANS") => void;
    isRegistering: boolean;
    setIsRegistering: (reg: boolean) => void;
    editingPatientId: string | null;
    setEditingPatientId: (id: string | null) => void;
    newPatient: any;
    setNewPatient: any;
    registerPatient: (e: React.FormEvent) => void;
    previewId: string;
    tempSignal: number[] | null;
    tempFileName: string;
    setTempSignal: (sig: number[] | null) => void;
    setTempFileName: (name: string) => void;
    patientSearch: string;
    setPatientSearch: (q: string) => void;
    patientSort: string;
    setPatientSort: (s: string) => void;
    patientScanSort: string;
    setPatientScanSort: (s: string) => void;
    patients: Patient[];
    selectedPatientId: string | null;
    setSelectedPatientId: (id: string | null) => void;
    selectedPatientScans: any[];
    startEditingPatient: (p: Patient) => void;
    deletePatient: (id: string) => void;
    deleteScan: (scanId: number, patientId: string) => void;
    loadPatientScan: (scan: any) => void;
    history: HistoryItem[];
    scanFilter: string;
    setScanFilter: (f: string) => void;
    scanSort: string;
    setScanSort: (s: string) => void;
    loadHistoryItem: (item: HistoryItem) => void;
}

export default function Sidebar({
    setDiagnosis,
    sidebarTab,
    setSidebarTab,
    isRegistering,
    setIsRegistering,
    editingPatientId,
    setEditingPatientId,
    newPatient,
    setNewPatient,
    registerPatient,
    previewId,
    tempSignal,
    tempFileName,
    setTempSignal,
    setTempFileName,
    patientSearch,
    setPatientSearch,
    patientSort,
    setPatientSort,
    patientScanSort,
    setPatientScanSort,
    patients,
    selectedPatientId,
    setSelectedPatientId,
    selectedPatientScans,
    startEditingPatient,
    deletePatient,
    deleteScan,
    loadPatientScan,
    history,
    scanFilter,
    setScanFilter,
    scanSort,
    setScanSort,
    loadHistoryItem,
}: SidebarProps) {
    return (
        <div className="w-80 shrink-0 bg-card-bg border-r border-border-subtle p-6 flex flex-col h-screen sticky top-0 overflow-y-auto z-10 shadow-md">
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-border-subtle">
                <h2 className="text-lg font-bold font-mono tracking-wide text-text-primary">ECG REGISTRY</h2>
                <button 
                    onClick={() => setDiagnosis(null)}
                    className="text-[10px] font-mono font-bold px-2 py-1 bg-brand-primary-light hover:bg-brand-primary-light-border text-brand-primary border border-brand-primary-light-border rounded-none cursor-pointer active:scale-95"
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
                            onClick={() => {
                                if (isRegistering) {
                                    setIsRegistering(false);
                                    setEditingPatientId(null);
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
                                } else {
                                    setIsRegistering(true);
                                }
                            }}
                            className="w-full py-2 bg-brand-primary-light text-brand-primary hover:bg-brand-primary-light-hover border border-brand-primary-light-border text-[11px] font-mono font-bold transition-all cursor-pointer rounded-none active:scale-[0.98]"
                        >
                            {isRegistering 
                                ? (editingPatientId ? "✕ CANCEL EDIT" : "✕ CANCEL REGISTRATION") 
                                : "＋ REGISTER NEW PATIENT"
                            }
                        </button>

                        {isRegistering ? (
                            <PatientForm
                                editingPatientId={editingPatientId}
                                previewId={previewId}
                                newPatient={newPatient}
                                setNewPatient={setNewPatient}
                                tempSignal={tempSignal}
                                tempFileName={tempFileName}
                                setTempSignal={setTempSignal}
                                setTempFileName={setTempFileName}
                                onSubmit={registerPatient}
                            />
                        ) : (
                            <PatientList
                                patients={patients}
                                selectedPatientId={selectedPatientId}
                                setSelectedPatientId={setSelectedPatientId}
                                selectedPatientScans={selectedPatientScans}
                                patientSearch={patientSearch}
                                setPatientSearch={setPatientSearch}
                                patientSort={patientSort}
                                setPatientSort={setPatientSort}
                                patientScanSort={patientScanSort}
                                setPatientScanSort={setPatientScanSort}
                                startEditingPatient={startEditingPatient}
                                deletePatient={deletePatient}
                                deleteScan={deleteScan}
                                loadPatientScan={loadPatientScan}
                                setDiagnosis={setDiagnosis}
                            />
                        )}
                    </div>
                ) : (
                    <ScanHistory
                        history={history}
                        scanFilter={scanFilter}
                        setScanFilter={setScanFilter}
                        scanSort={scanSort}
                        setScanSort={setScanSort}
                        loadHistoryItem={loadHistoryItem}
                    />
                )}
            </div>
        </div>
    );
}
