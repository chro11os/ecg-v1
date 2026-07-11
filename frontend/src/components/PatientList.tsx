import type { Patient } from "../types";

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

export default function PatientList({
    patients,
    selectedPatientId,
    setSelectedPatientId,
    selectedPatientScans,
    patientSearch,
    setPatientSearch,
    patientSort,
    setPatientSort,
    patientScanSort,
    setPatientScanSort,
    startEditingPatient,
    deletePatient,
    deleteScan,
    loadPatientScan,
    setDiagnosis,
}: PatientListProps) {
    return (
        <div className="space-y-3">
            <div className="space-y-2">
                <div className="relative">
                    <input
                        type="text"
                        value={patientSearch}
                        onChange={(e) => setPatientSearch(e.target.value)}
                        placeholder="SEARCH PATIENT (BY ID OR NAME)..."
                        className="w-full bg-card-bg border border-border-subtle text-[10px] font-mono p-2 pr-8 rounded-none uppercase placeholder:text-brand-secondary-dimmed focus:border-brand-primary focus:outline-none"
                    />
                    {patientSearch && (
                        <button
                            onClick={() => setPatientSearch("")}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-brand-secondary-muted hover:text-brand-primary text-xs cursor-pointer"
                            title="Clear search"
                        >
                            ✕
                        </button>
                    )}
                </div>
                <div className="flex items-center justify-between gap-2">
                    <label className="text-[8px] font-mono text-brand-secondary uppercase select-none font-bold">Sort Patients:</label>
                    <select
                        value={patientSort}
                        onChange={e => setPatientSort(e.target.value)}
                        className="bg-bg-canvas border border-border-subtle text-[9px] p-1 rounded-none font-mono text-text-primary cursor-pointer font-bold w-48 text-right focus:outline-none focus:border-brand-primary/50"
                    >
                        <option value="ID_ASC">ID (A→Z)</option>
                        <option value="NAME_ASC">NAME (A→Z)</option>
                        <option value="RISK_DESC">STROKE RISK (HIGH→LOW)</option>
                        <option value="BURDEN_DESC">CUMULATIVE BURDEN (HIGH→LOW)</option>
                        <option value="AGE_DESC">AGE (HIGH→LOW)</option>
                    </select>
                </div>
            </div>

            {patients
                .filter(patient => 
                    patient.id.toLowerCase().includes(patientSearch.toLowerCase()) ||
                    patient.name.toLowerCase().includes(patientSearch.toLowerCase())
                )
                .sort((a, b) => {
                    if (patientSort === "ID_ASC") {
                        return a.id.localeCompare(b.id);
                    }
                    if (patientSort === "NAME_ASC") {
                        return a.name.localeCompare(b.name);
                    }
                    if (patientSort === "RISK_DESC") {
                        return (b.stroke_risk_score ?? 0) - (a.stroke_risk_score ?? 0);
                    }
                    if (patientSort === "BURDEN_DESC") {
                        return (b.cumulative_burden ?? 0) - (a.cumulative_burden ?? 0);
                    }
                    if (patientSort === "AGE_DESC") {
                        return b.age - a.age;
                    }
                    return 0;
                })
                .map((patient) => {
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
                                setDiagnosis(null); // close active scan log and focus on targeted patient
                            }}
                            className="flex justify-between items-center cursor-pointer hover:text-brand-primary transition-colors"
                        >
                            <div className="flex items-center gap-3">
                                {/* Profile Picture Thumbnail */}
                                <div className="w-8 h-8 rounded-none border border-border-subtle bg-bg-canvas overflow-hidden shrink-0">
                                    <img 
                                        src={patient.picture_url || "https://upload.wikimedia.org/wikipedia/commons/2/2c/Default_pfp.svg"} 
                                        alt="Profile Thumbnail" 
                                        className="w-full h-full object-cover"
                                    />
                                </div>
                                <div>
                                    <p className="text-xs font-mono font-bold text-zinc-500">Patient: {patient.id}</p>
                                    <p className="text-[10px] font-bold text-brand-primary">{patient.name}</p>
                                    <p className="text-[9px] text-brand-secondary font-mono mt-0.5">{patient.gender.toUpperCase()}, {patient.age} Y/O</p>
                                </div>
                            </div>
                            <span className="text-xs font-mono">{isExpanded ? "▲" : "▼"}</span>
                        </div>

                        {isExpanded && (
                            <div className="mt-3 border-t border-border-subtle pt-2 space-y-2 animate-in fade-in slide-in-from-top-1 duration-200">
                                {/* Clinical Summary snippet in patient registry */}
                                <div className="p-2 bg-bg-canvas-card border border-border-subtle font-mono text-[9px] text-brand-secondary space-y-1">
                                    <div>STROKE RISK: <span className="font-bold text-brand-primary">{patient.stroke_risk_score} PTS</span></div>
                                    <div>CUMULATIVE BURDEN: <span className="font-bold text-status-critical">{patient.cumulative_burden ?? 0.0}%</span></div>
                                </div>

                                <div className="flex gap-2">
                                    <button
                                        onClick={() => startEditingPatient(patient)}
                                        className="flex-1 py-1.5 bg-brand-primary-light hover:bg-brand-primary-light-hover text-brand-primary border border-brand-primary-light-border text-[9px] font-mono font-bold cursor-pointer flex items-center justify-center gap-1 active:scale-[0.97] transition-all"
                                    >
                                        <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                        </svg>
                                        EDIT PROFILE
                                    </button>
                                    <button
                                        onClick={() => deletePatient(patient.id)}
                                        className="flex-1 py-1.5 bg-status-critical-light hover:bg-status-critical-light-border text-status-critical border border-status-critical-light-border text-[9px] font-mono font-bold cursor-pointer flex items-center justify-center gap-1 active:scale-[0.97] transition-all"
                                    >
                                        <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                        DELETE PATIENT
                                    </button>
                                </div>

                                <div className="flex justify-between items-center mt-2 pb-1 border-b border-border-subtle">
                                    <p className="text-[9px] font-mono font-bold text-brand-secondary uppercase">Scan Logs:</p>
                                    <select
                                        value={patientScanSort}
                                        onChange={e => setPatientScanSort(e.target.value)}
                                        className="bg-transparent text-brand-secondary text-[8px] font-mono cursor-pointer border-none focus:outline-none font-bold"
                                    >
                                        <option value="NEWEST">NEWEST FIRST</option>
                                        <option value="OLDEST">OLDEST FIRST</option>
                                        <option value="BURDEN_DESC">BURDEN (HIGH→LOW)</option>
                                    </select>
                                </div>
                                {selectedPatientScans.length === 0 ? (
                                    <p className="text-[9px] font-mono text-brand-secondary-muted text-center py-2">NO UPLOADED SCANS</p>
                                ) : (
                                    [...selectedPatientScans]
                                        .sort((a, b) => {
                                            if (patientScanSort === "NEWEST") {
                                                return b.timestamp.localeCompare(a.timestamp);
                                            }
                                            if (patientScanSort === "OLDEST") {
                                                return a.timestamp.localeCompare(b.timestamp);
                                            }
                                            if (patientScanSort === "BURDEN_DESC") {
                                                return b.predicted_class - a.predicted_class;
                                            }
                                            return 0;
                                        })
                                        .map((scan) => (
                                        <div 
                                            key={scan.id}
                                            onClick={() => loadPatientScan(scan)}
                                            className="p-2 bg-card-bg border border-border-subtle hover:border-brand-primary cursor-pointer transition-all duration-150 hover:translate-x-1 active:scale-[0.98]"
                                        >
                                            <div className="flex justify-between items-center text-[10px] font-mono">
                                                <span className="font-bold text-brand-secondary">Scan #{scan.id}</span>
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-brand-secondary-muted text-[8px]">{scan.timestamp.split(" ")[0]}</span>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            deleteScan(scan.id, patient.id);
                                                        }}
                                                        className="text-status-critical hover:text-status-critical-hover transition-all p-0.5 hover:bg-status-critical-light flex items-center justify-center cursor-pointer active:scale-90"
                                                        title="Delete Scan"
                                                    >
                                                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5">
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                        </svg>
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="flex justify-between items-center mt-2">
                                                <span className={`px-1.5 py-0.2 text-[8px] font-mono font-bold rounded-none uppercase tracking-wider ${
                                                    scan.predicted_class === 0 ? 'bg-status-healthy-light text-status-healthy border border-status-healthy-light-border' :
                                                    scan.predicted_class === 1 ? 'bg-status-info-light text-status-info border border-status-info-light-border' :
                                                    scan.predicted_class === 2 ? 'bg-status-warning-light text-status-warning border border-status-warning-light-border' :
                                                    'bg-status-critical-light text-status-critical border border-status-critical-light-border'
                                                }`}>
                                                    {scan.predicted_class === 0 ? 'Sinus Rhythm' :
                                                     scan.predicted_class === 1 ? 'Micro' :
                                                     scan.predicted_class === 2 ? 'Intermed.' : 'High'}
                                                </span>
                                                <span className="text-[9px] font-mono text-brand-secondary">{Math.round(scan.confidence * 100)}% CONF</span>
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
    );
}
