import { useState } from "react";
import DiagnosisDashboard from "./components/DiagnosisDashboard";
import FileUploadArea from "./components/FileUploadArea";

export default function App() {
    const [diagnosis, setDiagnosis] = useState<DiagnosisData | null>(null);
    const [loading, setLoading] = useState(false);

    const handleAnalysis = async (signal: number[]) => {
        setLoading(true);
        try {
            const response = await fetch("http://localhost:8000/predict", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ signal }), // Contract matching Pydantic model
            });
            const data = await response.json();
            setDiagnosis(data);
        } catch (err) {
            console.error("Inference Failed", err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 p-6 space-y-6">
            {!diagnosis && (
                <div className="max-w-xl mx-auto mt-20">
                    <FileUploadArea onDataLoaded={handleAnalysis} onError={(m) => alert(m)} />
                    {loading && <p className="text-center mt-4 text-cyan-400 animate-pulse font-mono">RUNNING INFERENCE ON MPS...</p>}
                </div>
            )}

            {diagnosis && (
                <div className="animate-in fade-in duration-700">
                    <DiagnosisDashboard data={diagnosis} onReset={() => setDiagnosis(null)} />
                </div>
            )}
        </div>
    );
}