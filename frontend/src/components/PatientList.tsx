import type { BurdenTier, Patient } from "../types";
import TierTag from "./TierTag";

interface PatientListProps {
    patients: Patient[];
    selectedPatientId: string | null;
    setSelectedPatientId: (id: string | null) => void;
    selectedPatientScans: any[];
    patientSearch: string;
    setPatientSearch: (q: string) => void;
    patientSort: string;
    setPatientSort: (s: string) => void;
    patientScanSort: string;
    setPatientScanSort: (s: string) => void;
    startEditingPatient: (p: Patient) => void;
    deletePatient: (id: string) => void;
    deleteScan: (scanId: number, patientId: string) => void;
    loadPatientScan: (scan: any) => void;
    setDiagnosis: (diag: any) => void;
}

const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join("");

const scanDate = (timestamp: string) => {
    const d = new Date(timestamp.replace(" ", "T"));
    return isNaN(d.getTime()) ? timestamp : d.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
};

export default function PatientList({
    patients, selectedPatientId, setSelectedPatientId, selectedPatientScans, patientSearch, setPatientSearch,
    patientSort, setPatientSort, patientScanSort, setPatientScanSort, startEditingPatient, deletePatient,
    deleteScan, loadPatientScan, setDiagnosis,
}: PatientListProps) {
    const query = patientSearch.toLowerCase();
    const shown = patients
        .filter(p => p.id.toLowerCase().includes(query) || p.name.toLowerCase().includes(query))
        .sort((a, b) => {
            if (patientSort === "NAME_ASC") return a.name.localeCompare(b.name);
            if (patientSort === "RISK_DESC") return (b.stroke_risk_score ?? 0) - (a.stroke_risk_score ?? 0);
            if (patientSort === "BURDEN_DESC") return (b.cumulative_burden ?? 0) - (a.cumulative_burden ?? 0);
            if (patientSort === "AGE_DESC") return b.age - a.age;
            return a.id.localeCompare(b.id);
        });

    const scans = [...selectedPatientScans].sort((a, b) => {
        if (patientScanSort === "OLDEST") return a.timestamp.localeCompare(b.timestamp);
        if (patientScanSort === "BURDEN_DESC") return (b.afib_burden ?? b.predicted_class) - (a.afib_burden ?? a.predicted_class);
        return b.timestamp.localeCompare(a.timestamp);
    });

    return (
        <div className="space-y-3">
            <input
                type="search"
                value={patientSearch}
                onChange={e => setPatientSearch(e.target.value)}
                placeholder="Search by name or ID"
                aria-label="Search patients"
                className="w-full rounded-md border border-line bg-sheet px-3 py-2 text-sm placeholder:text-ink-faint"
            />
            <label className="flex items-center justify-between gap-2 text-sm text-ink-soft">
                Sort by
                <select value={patientSort} onChange={e => setPatientSort(e.target.value)} className="rounded-md border border-line bg-sheet px-2 py-1 text-sm text-ink">
                    <option value="ID_ASC">Patient ID</option>
                    <option value="NAME_ASC">Name</option>
                    <option value="RISK_DESC">Stroke risk, highest first</option>
                    <option value="BURDEN_DESC">Scans with AFib, most first</option>
                    <option value="AGE_DESC">Age, oldest first</option>
                </select>
            </label>

            {shown.length === 0 && (
                <p className="py-6 text-center text-sm text-ink-soft">
                    {patients.length ? "No patients match that search." : "No patients yet. Register one to save scans to their record."}
                </p>
            )}

            <ul className="-mx-2 space-y-0.5">
                {shown.map(patient => {
                    const open = selectedPatientId === patient.id;
                    return (
                        <li key={patient.id} className={`rounded-lg ${open ? "bg-hover" : ""}`}>
                            <button
                                onClick={() => { setSelectedPatientId(open ? null : patient.id); setDiagnosis(null); }}
                                aria-expanded={open}
                                className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-hover"
                            >
                                {patient.picture_url ? (
                                    <img src={patient.picture_url} alt="" className="size-9 shrink-0 rounded-full object-cover" />
                                ) : (
                                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-ink text-xs font-semibold text-white" aria-hidden>
                                        {initials(patient.name)}
                                    </span>
                                )}
                                <span className="min-w-0">
                                    <span className="block truncate font-medium">{patient.name}</span>
                                    <span className="block text-sm text-ink-soft">{patient.id}, {patient.gender}, {patient.age}</span>
                                </span>
                            </button>

                            {open && (
                                <div className="space-y-3 px-2 pb-3 pt-1">
                                    <dl className="grid grid-cols-2 gap-2 text-sm">
                                        <div>
                                            <dt className="text-ink-soft">Stroke risk</dt>
                                            <dd className="font-semibold">{patient.stroke_risk_score ?? 0} points</dd>
                                        </div>
                                        <div>
                                            <dt className="text-ink-soft">Scans with AFib</dt>
                                            <dd className="font-semibold">{patient.cumulative_burden ?? 0}%</dd>
                                        </div>
                                    </dl>
                                    <div className="flex gap-2">
                                        <button onClick={() => startEditingPatient(patient)} className="flex-1 rounded-md border border-line bg-sheet py-1.5 text-sm hover:bg-page">
                                            Edit details
                                        </button>
                                        <button onClick={() => deletePatient(patient.id)} className="flex-1 rounded-md border border-line bg-sheet py-1.5 text-sm text-danger hover:bg-page">
                                            Delete patient
                                        </button>
                                    </div>

                                    <div className="flex items-center justify-between border-t border-line pt-3">
                                        <h3 className="text-sm font-semibold">Scans</h3>
                                        <select value={patientScanSort} onChange={e => setPatientScanSort(e.target.value)} aria-label="Sort scans"
                                            className="rounded border-none bg-transparent text-sm text-ink-soft">
                                            <option value="NEWEST">Newest first</option>
                                            <option value="OLDEST">Oldest first</option>
                                            <option value="BURDEN_DESC">Highest burden first</option>
                                        </select>
                                    </div>
                                    {scans.length === 0 ? (
                                        <p className="text-sm text-ink-soft">No scans yet. Upload or simulate a strip to add one.</p>
                                    ) : (
                                        <ul className="space-y-1">
                                            {scans.map(scan => (
                                                <li key={scan.id} className="group flex items-center rounded-md bg-sheet">
                                                    <button onClick={() => loadPatientScan(scan)} className="min-w-0 flex-1 rounded-md px-2.5 py-2 text-left hover:bg-page">
                                                        <span className="flex justify-between text-xs text-ink-soft">
                                                            <span>Scan {scan.id}</span>
                                                            <span>{scanDate(scan.timestamp)}</span>
                                                        </span>
                                                        <TierTag tier={scan.predicted_class as BurdenTier} burden={scan.afib_burden} />
                                                    </button>
                                                    <button
                                                        onClick={() => deleteScan(scan.id, patient.id)}
                                                        className="mr-1 rounded p-1.5 text-ink-faint hover:bg-page hover:text-danger"
                                                        aria-label={`Delete scan ${scan.id}`}
                                                    >
                                                        <svg className="size-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" aria-hidden>
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                        </svg>
                                                    </button>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            )}
                        </li>
                    );
                })}
            </ul>
        </div>
    );
}
