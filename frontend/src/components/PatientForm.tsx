import React from "react";
import FileUploadArea from "./FileUploadArea";

interface PatientFormProps {
    editingPatientId: string | null;
    previewId: string;
    newPatient: {
        id: string;
        name: string;
        age: number;
        gender: string;
        hypertension: boolean;
        diabetes: boolean;
        stroke_history: boolean;
        vascular_disease: boolean;
        heart_failure: boolean;
    };
    setNewPatient: React.Dispatch<React.SetStateAction<any>>;
    tempSignal: number[] | null;
    tempFileName: string;
    setTempSignal: (sig: number[] | null) => void;
    setTempFileName: (name: string) => void;
    onSubmit: (e: React.FormEvent) => void;
}

export default function PatientForm({
    editingPatientId,
    previewId,
    newPatient,
    setNewPatient,
    tempSignal,
    tempFileName,
    setTempSignal,
    setTempFileName,
    onSubmit,
}: PatientFormProps) {
    return (
        <form onSubmit={onSubmit} className="bg-bg-canvas p-3 border border-border-subtle space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
            <div>
                <label className="block text-[9px] font-mono text-brand-secondary uppercase">Patient ID</label>
                <div className="w-full bg-bg-canvas border border-border-subtle text-xs p-1.5 mt-0.5 rounded-none font-mono text-zinc-500 select-none">
                    {editingPatientId ? editingPatientId : (previewId || "Fetching ID...")} {!editingPatientId && <span className="opacity-60 italic text-[10px]">(Preview)</span>}
                </div>
            </div>
            <div>
                <label className="block text-[9px] font-mono text-brand-secondary uppercase">Full Name *</label>
                <input
                    type="text"
                    required
                    value={newPatient.name}
                    onChange={e => setNewPatient((prev: any) => ({ ...prev, name: e.target.value }))}
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
                            setNewPatient((prev: any) => ({ ...prev, age: val === "" ? "" as any : Number(val) }));
                        }}
                        className="w-full bg-card-bg border border-border-subtle text-xs p-1 mt-0.5 rounded-none font-mono"
                    />
                </div>
                <div>
                    <label className="block text-[9px] font-mono text-brand-secondary uppercase">Gender *</label>
                    <select
                        value={newPatient.gender}
                        onChange={e => setNewPatient((prev: any) => ({ ...prev, gender: e.target.value }))}
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
                    <input type="checkbox" checked={newPatient.heart_failure} onChange={e => setNewPatient((prev: any) => ({ ...prev, heart_failure: e.target.checked }))} />
                    Heart Failure (+1)
                </label>
                <label className="flex items-center gap-1.5 text-[10px] font-mono cursor-pointer">
                    <input type="checkbox" checked={newPatient.hypertension} onChange={e => setNewPatient((prev: any) => ({ ...prev, hypertension: e.target.checked }))} />
                    Hypertension (+1)
                </label>
                <label className="flex items-center gap-1.5 text-[10px] font-mono cursor-pointer">
                    <input type="checkbox" checked={newPatient.diabetes} onChange={e => setNewPatient((prev: any) => ({ ...prev, diabetes: e.target.checked }))} />
                    Diabetes (+1)
                </label>
                <label className="flex items-center gap-1.5 text-[10px] font-mono cursor-pointer">
                    <input type="checkbox" checked={newPatient.stroke_history} onChange={e => setNewPatient((prev: any) => ({ ...prev, stroke_history: e.target.checked }))} />
                    Stroke / TIA (+2)
                </label>
                <label className="flex items-center gap-1.5 text-[10px] font-mono cursor-pointer">
                    <input type="checkbox" checked={newPatient.vascular_disease} onChange={e => setNewPatient((prev: any) => ({ ...prev, vascular_disease: e.target.checked }))} />
                    Vascular Disease (+1)
                </label>
            </div>

            {/* File upload section inside patient creation */}
            {!editingPatientId && (
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
            )}

            <button
                type="submit"
                className="w-full py-2 bg-status-healthy text-white hover:bg-status-healthy-hover text-[10.5px] font-mono font-bold rounded-none cursor-pointer active:scale-[0.98] transition-all"
            >
                {editingPatientId ? "SAVE PATIENT CHANGES" : "SUBMIT PROFILE & RUN ECG"}
            </button>
        </form>
    );
}
