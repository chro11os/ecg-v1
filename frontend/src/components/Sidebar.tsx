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
    realHistory: HistoryItem[];
    simulatedHistory: HistoryItem[];
    scanSource: "real" | "simulated";
    setScanSource: (src: "real" | "simulated") => void;
    scanFilter: string;
    setScanFilter: (f: string) => void;
    scanSort: string;
    setScanSort: (s: string) => void;
    loadHistoryItem: (item: HistoryItem) => void;
}

const EMPTY_PATIENT = {
    id: "", name: "", age: 65, gender: "male",
    hypertension: false, diabetes: false, stroke_history: false, vascular_disease: false, heart_failure: false,
};

export default function Sidebar(props: SidebarProps) {
    const {
        setDiagnosis, sidebarTab, setSidebarTab, isRegistering, setIsRegistering, editingPatientId, setEditingPatientId,
        setNewPatient, patients, selectedPatientId, setSelectedPatientId, realHistory, simulatedHistory, scanSource, setScanSource,
    } = props;

    const tab = (value: "PATIENTS" | "SCANS", label: string) => (
        <button
            role="tab"
            aria-selected={sidebarTab === value}
            onClick={() => setSidebarTab(value)}
            className={`flex-1 border-b-2 bg-transparent pb-2 text-sm font-medium transition-colors ${
                sidebarTab === value ? "border-ink text-ink" : "border-transparent text-ink-soft hover:text-ink"
            }`}
        >
            {label}
        </button>
    );

    return (
        <aside className="flex w-full shrink-0 flex-col border-b border-line bg-sheet lg:sticky lg:top-0 lg:h-screen lg:w-80 lg:border-b-0 lg:border-r">
            <button
                onClick={() => { setDiagnosis(null); setSelectedPatientId(null); }}
                className="flex items-center gap-3 px-5 pb-4 pt-5 text-left"
                title="Back to start"
            >
                <img src="https://upload.wikimedia.org/wikipedia/en/f/f8/Mapua_Uni_logo.svg" alt="Mapúa University" className="h-8 w-auto" />
                <span>
                    <span className="block text-lg font-bold leading-none" style={{ fontStretch: "120%" }}>GTT</span>
                    <span className="block text-xs text-ink-soft">AFib burden assessment</span>
                </span>
            </button>

            <div className="flex gap-4 px-5" role="tablist">
                {tab("PATIENTS", `Patients (${patients.length})`)}
                {tab("SCANS", "Scans")}
            </div>

            <div className="max-h-[60vh] flex-1 overflow-y-auto border-t border-line px-5 py-4 lg:max-h-none">
                {sidebarTab === "PATIENTS" ? (
                    <div className="space-y-4">
                        <button
                            onClick={() => {
                                if (isRegistering) {
                                    setIsRegistering(false);
                                    setEditingPatientId(null);
                                    setNewPatient(EMPTY_PATIENT);
                                } else {
                                    setIsRegistering(true);
                                }
                            }}
                            className="w-full rounded-md border border-ink py-2 text-sm font-medium hover:bg-hover"
                        >
                            {isRegistering ? (editingPatientId ? "Cancel editing" : "Cancel registration") : "Register a patient"}
                        </button>

                        {isRegistering ? (
                            <PatientForm
                                editingPatientId={editingPatientId}
                                previewId={props.previewId}
                                newPatient={props.newPatient}
                                setNewPatient={setNewPatient}
                                tempSignal={props.tempSignal}
                                tempFileName={props.tempFileName}
                                setTempSignal={props.setTempSignal}
                                setTempFileName={props.setTempFileName}
                                onSubmit={props.registerPatient}
                            />
                        ) : (
                            <PatientList
                                patients={patients}
                                selectedPatientId={selectedPatientId}
                                setSelectedPatientId={setSelectedPatientId}
                                selectedPatientScans={props.selectedPatientScans}
                                patientSearch={props.patientSearch}
                                setPatientSearch={props.setPatientSearch}
                                patientSort={props.patientSort}
                                setPatientSort={props.setPatientSort}
                                patientScanSort={props.patientScanSort}
                                setPatientScanSort={props.setPatientScanSort}
                                startEditingPatient={props.startEditingPatient}
                                deletePatient={props.deletePatient}
                                deleteScan={props.deleteScan}
                                loadPatientScan={props.loadPatientScan}
                                setDiagnosis={setDiagnosis}
                            />
                        )}
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="flex rounded-md border border-line p-0.5" role="group" aria-label="Which scans">
                            {([["real", `Saved (${realHistory.length})`], ["simulated", `Simulated (${simulatedHistory.length})`]] as const).map(([value, label]) => (
                                <button
                                    key={value}
                                    onClick={() => setScanSource(value)}
                                    aria-pressed={scanSource === value}
                                    className={`flex-1 rounded px-2 py-1.5 text-sm font-medium transition-colors ${
                                        scanSource === value ? "bg-ink text-white" : "text-ink-soft hover:bg-hover"
                                    }`}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                        <ScanHistory
                            history={scanSource === "real" ? realHistory : simulatedHistory}
                            emptyText={scanSource === "real" ? "No saved scans yet." : "Simulated scans from this session appear here."}
                            scanFilter={props.scanFilter}
                            setScanFilter={props.setScanFilter}
                            scanSort={props.scanSort}
                            setScanSort={props.setScanSort}
                            loadHistoryItem={props.loadHistoryItem}
                        />
                    </div>
                )}
            </div>
        </aside>
    );
}
