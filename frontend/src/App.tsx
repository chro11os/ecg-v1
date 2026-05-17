import { useState } from "react";
import type { DiagnosisData } from "./types";
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
                body: JSON.stringify({ signal }),
            });

            const result = await response.json();

            setDiagnosis({
                severity: result.severity_class,
                confidence: Math.round(result.confidence * 100.0),
                burden: Math.round(result.confidence * 85.0),
                hardware: result.hardware_used,
                responseTime: 124.0,
            });
        } catch (error) {
            console.error("Inference Error:", error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="main bg-slate-950 min-h-screen flex items-center justify-center p-6">
            {!diagnosis ? (
                <div className="w-full max-w-xl">
                    {/* Fix TS2739: Provide both onDataLoaded and onError */}
                    <FileUploadArea
                        onDataLoaded={handleAnalysis}
                        onError={(msg) => alert(msg)}
                    />
                    {loading && <p className="text-cyan-400 mt-4 text-center animate-pulse">ANALYZING SIGNAL...</p>}
                </div>
            ) : (
                <DiagnosisDashboard
                    data={diagnosis}
                    onReset={() => setDiagnosis(null)}
                />
            )}
        </div>
    );
}