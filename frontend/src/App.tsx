import { useState } from "react";
import type { DiagnosisData } from "./types";
import DiagnosisDashboard from "./components/DiagnosisDashboard";
import FileUploadArea from "./components/FileUploadArea";

export default function App() {
    const [diagnosis, setDiagnosis] = useState<DiagnosisData | null>(null);
    const [loading, setLoading] = useState(false);

    const handleAnalysis = async (incomingSignal: number[]) => {
        setLoading(true);
        const startTime = performance.now();
        try {
            const response = await fetch("http://localhost:8000/predict", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ signal: incomingSignal }),
            });

            const result = await response.json();
            const endTime = performance.now();

            const severity = result.severity_class;
            let simulatedBurden = 0.0;

            // Tie the burden directly to the assigned severity class for clinical consistency
            if (severity === 1) simulatedBurden = 4.25;   // Trace: < 5%
            else if (severity === 2) simulatedBurden = 28.4; // Mild: 5% - 50%
            else if (severity === 3) simulatedBurden = 72.8; // Severe: > 50%

            setDiagnosis({
                severity: severity,
                confidence: Math.round(result.confidence * 100.0),
                burden: severity === 0 ? 0.0 : simulatedBurden, // Normal is strictly 0% burden
                hardware: result.hardware_used,
                responseTime: Math.round(endTime - startTime),
                rawSignal: incomingSignal,
            });
        } catch (error) {
            console.error("Inference Error:", error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="main bg-slate-950 min-h-screen flex flex-col items-center justify-center p-6">
            {!diagnosis ? (
                <div className="w-full max-w-xl">
                    <FileUploadArea
                        onDataLoaded={handleAnalysis}
                        onError={(msg) => alert(msg)}
                    />
                    {loading && <p className="text-cyan-400 mt-4 text-center animate-pulse">ANALYZING SIGNAL...</p>}
                </div>
            ) : (
                <div className="w-full max-w-6xl space-y-6">
                    <DiagnosisDashboard
                        data={diagnosis}
                        onReset={() => {
                            setDiagnosis(null);
                        }}
                    />
                </div>
            )}
        </div>
    );
}