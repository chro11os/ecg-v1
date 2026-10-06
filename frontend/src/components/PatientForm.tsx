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

const CONDITIONS = [
    ["heart_failure", "Heart failure", 1],
    ["hypertension", "Hypertension", 1],
    ["diabetes", "Diabetes", 1],
    ["stroke_history", "Stroke or TIA", 2],
    ["vascular_disease", "Vascular disease", 1],
] as const;

const input = "mt-1 w-full rounded-md border border-line bg-sheet px-2.5 py-1.5 text-sm";

export default function PatientForm({
    editingPatientId, previewId, newPatient, setNewPatient, tempSignal, tempFileName, setTempSignal, setTempFileName, onSubmit,
}: PatientFormProps) {
    const set = (field: string, value: unknown) => setNewPatient((prev: any) => ({ ...prev, [field]: value }));

    return (
        <form onSubmit={onSubmit} className="space-y-4">
            <p className="text-sm text-ink-soft">
                Patient ID <span className="font-medium text-ink">{editingPatientId ?? (previewId || "assigning…")}</span>
            </p>
            <label className="block text-sm text-ink-soft">
                Full name
                <input type="text" required value={newPatient.name} onChange={e => set("name", e.target.value)} className={`${input} text-ink`} />
            </label>
            <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm text-ink-soft">
                    Age
                    <input
                        type="number"
                        required
                        min={0}
                        max={120}
                        value={newPatient.age === 0 ? "" : newPatient.age}
                        onChange={e => set("age", e.target.value === "" ? "" : Number(e.target.value))}
                        className={`${input} text-ink`}
                    />
                </label>
                <label className="block text-sm text-ink-soft">
                    Sex
                    <select value={newPatient.gender} onChange={e => set("gender", e.target.value)} className={`${input} text-ink`}>
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                    </select>
                </label>
            </div>

            <fieldset className="space-y-2">
                <legend className="text-sm font-semibold">Conditions (for the stroke risk score)</legend>
                {CONDITIONS.map(([field, label, pts]) => (
                    <label key={field} className="flex cursor-pointer items-center gap-2 text-sm">
                        <input type="checkbox" checked={newPatient[field]} onChange={e => set(field, e.target.checked)} className="size-4 accent-ink" />
                        {label} <span className="text-ink-faint">+{pts}</span>
                    </label>
                ))}
            </fieldset>

            {!editingPatientId && (
                <div className="space-y-2">
                    <p className="text-sm font-semibold">First ECG strip <span className="font-normal text-ink-soft">(optional)</span></p>
                    {tempSignal ? (
                        <p className="flex items-center justify-between rounded-md bg-hover px-3 py-2 text-sm">
                            {tempFileName}
                            <button type="button" onClick={() => { setTempSignal(null); setTempFileName(""); }} className="text-ink-soft underline underline-offset-2">
                                Remove
                            </button>
                        </p>
                    ) : (
                        <FileUploadArea compact actionLabel="Use this strip" onDataLoaded={(signal, name) => { setTempSignal(signal); setTempFileName(name); }} onError={msg => alert(msg)} />
                    )}
                </div>
            )}

            <button type="submit" className="w-full rounded-md bg-ink py-2.5 text-sm font-medium text-white hover:bg-ink/85">
                {editingPatientId ? "Save changes" : tempSignal ? "Save patient and analyze strip" : "Save patient"}
            </button>
        </form>
    );
}
