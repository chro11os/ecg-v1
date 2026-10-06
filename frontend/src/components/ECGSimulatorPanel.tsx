import { useState, useEffect, useRef } from "react";
import { generateECGData } from "../utils/ecgSimulator";

interface ECGSimulatorPanelProps {
    onAnalyze: (signal: number[], fileName: string, simDemographics?: any) => void;
    patientName?: string;
}

const VISIBLE_SAMPLES = 750; // 3 s across the monitor
const ERASE_AHEAD = 35;      // samples cleared ahead of the sweep

export default function ECGSimulatorPanel({ onAnalyze, patientName }: ECGSimulatorPanelProps) {
    const [rhythm, setRhythm] = useState<"normal" | "afib">("normal");
    const [isSimulating, setIsSimulating] = useState(false);
    const [progress, setProgress] = useState(0);
    const [heartRate, setHeartRate] = useState(75);
    const [isBeeping, setIsBeeping] = useState(false);
    const [soundEnabled, setSoundEnabled] = useState(false);
    const [simulationCompleted, setSimulationCompleted] = useState(false);

    // Demographics for the anonymous profile's CHA2DS2-VASc score
    const [simAge, setSimAge] = useState<number>(65);
    const [simGender, setSimGender] = useState<string>("male");
    const [simCHF, setSimCHF] = useState(false);
    const [simHTN, setSimHTN] = useState(false);
    const [simDM, setSimDM] = useState(false);
    const [simStroke, setSimStroke] = useState(false);
    const [simVascular, setSimVascular] = useState(false);

    const calculatedScore =
        (simCHF ? 1 : 0) + (simHTN ? 1 : 0) + (simAge >= 75 ? 2 : simAge >= 65 ? 1 : 0) +
        (simDM ? 1 : 0) + (simStroke ? 2 : 0) + (simVascular ? 1 : 0) + (simGender === "female" ? 1 : 0);
    const riskCategory = calculatedScore >= 2 ? "high risk" : calculatedScore === 1 ? "moderate risk" : "low risk";

    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const animationRef = useRef<number | null>(null);
    const audioCtxRef = useRef<AudioContext | null>(null);
    const simulatedSignalRef = useRef<number[]>([]);
    const simulatedPeaksRef = useRef<number[]>([]);
    const currentIdxRef = useRef(0);
    const lastTimeRef = useRef(0);
    const lastBeatIndexRef = useRef(-1);

    const clearCanvas = () => {
        const canvas = canvasRef.current;
        canvas?.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    };

    const initializeSignal = () => {
        const { signal, rPeaks } = generateECGData(rhythm, 2500);
        simulatedSignalRef.current = signal;
        simulatedPeaksRef.current = rPeaks;
        currentIdxRef.current = 0;
        lastBeatIndexRef.current = -1;
        setSimulationCompleted(false);
        setProgress(0);
        setHeartRate(rhythm === "normal" ? 75 : 85);
        clearCanvas();
    };

    useEffect(() => {
        initializeSignal();
        return () => {
            if (animationRef.current) cancelAnimationFrame(animationRef.current);
        };
    }, [rhythm]);

    const playBeep = () => {
        if (!soundEnabled) return;
        try {
            audioCtxRef.current ??= new (window.AudioContext || (window as any).webkitAudioContext)();
            const ctx = audioCtxRef.current;
            if (ctx.state === "suspended") ctx.resume();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = "sine";
            osc.frequency.setValueAtTime(450, ctx.currentTime);
            gain.gain.setValueAtTime(0.06, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
            osc.connect(gain);
            gain.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + 0.08);
        } catch (e) {
            console.error("Audio error", e);
        }
    };

    const animate = (timestamp: number) => {
        if (!lastTimeRef.current) lastTimeRef.current = timestamp;
        const elapsed = timestamp - lastTimeRef.current;
        lastTimeRef.current = timestamp;

        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d");
        if (!canvas || !ctx) return;

        const signal = simulatedSignalRef.current;
        const rPeaks = simulatedPeaksRef.current;
        const startIdx = currentIdxRef.current;
        const endIdx = Math.min(signal.length, startIdx + Math.max(1, Math.round(elapsed * 0.25))); // 250 Hz
        const colWidth = canvas.width / VISIBLE_SAMPLES;
        const centerY = canvas.height / 2;
        const scaleY = canvas.height * 0.45;

        ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue("--color-ink").trim();
        ctx.lineWidth = 2;
        for (let i = startIdx; i < endIdx; i++) {
            const pos = i % VISIBLE_SAMPLES;
            const x = pos * colWidth;
            ctx.clearRect(x, 0, colWidth * ERASE_AHEAD, canvas.height); // the paper grid shows through

            const prevPos = (i - 1) % VISIBLE_SAMPLES;
            if (i > 0 && prevPos < pos) {
                ctx.beginPath();
                ctx.moveTo(prevPos * colWidth, centerY - signal[i - 1] * scaleY);
                ctx.lineTo(x, centerY - signal[i] * scaleY);
                ctx.stroke();
            }

            if (rPeaks.includes(i) && i !== lastBeatIndexRef.current) {
                lastBeatIndexRef.current = i;
                setIsBeeping(true);
                playBeep();
                setTimeout(() => setIsBeeping(false), 150);
                setHeartRate(rhythm === "normal" ? 72 + Math.round(Math.random() * 6) : 80 + Math.round(Math.random() * 70));
            }
        }

        currentIdxRef.current = endIdx;
        setProgress(Math.round((endIdx / signal.length) * 100));
        if (endIdx >= signal.length) {
            setIsSimulating(false);
            setSimulationCompleted(true);
            setHeartRate(0);
        } else {
            animationRef.current = requestAnimationFrame(animate);
        }
    };

    useEffect(() => {
        if (isSimulating) {
            animationRef.current = requestAnimationFrame(animate);
        } else if (animationRef.current) {
            cancelAnimationFrame(animationRef.current);
        }
        return () => {
            if (animationRef.current) cancelAnimationFrame(animationRef.current);
        };
    }, [isSimulating]);

    const startSimulation = () => {
        if (simulationCompleted) initializeSignal();
        lastTimeRef.current = 0;
        setIsSimulating(true);
    };

    const resetSimulation = () => {
        setIsSimulating(false);
        initializeSignal();
    };

    const handleAnalyze = () => {
        if (!simulatedSignalRef.current.length) return;
        const fileName = `simulated_${rhythm}_${Date.now().toString().slice(-6)}.json`;
        onAnalyze(simulatedSignalRef.current, fileName, patientName ? undefined : {
            age: simAge,
            gender: simGender,
            hypertension: simHTN,
            diabetes: simDM,
            stroke_history: simStroke,
            vascular_disease: simVascular,
            heart_failure: simCHF,
        });
    };

    const checkbox = (label: string, checked: boolean, set: (v: boolean) => void) => (
        <label className="flex cursor-pointer items-center gap-2 text-sm">
            <input type="checkbox" checked={checked} onChange={e => set(e.target.checked)} className="size-4 accent-ink" />
            {label}
        </label>
    );

    return (
        <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="max-w-md text-sm text-ink-soft">
                    Generates a synthetic 10-second strip. Handy for trying the app, but the model learned from real recordings, so read these results as a demo.
                </p>
                <div className="flex rounded-md border border-line bg-sheet p-0.5" role="group" aria-label="Rhythm to simulate">
                    {([["normal", "Normal rhythm"], ["afib", "AFib"]] as const).map(([value, label]) => (
                        <button
                            key={value}
                            onClick={() => setRhythm(value)}
                            disabled={isSimulating}
                            aria-pressed={rhythm === value}
                            className={`rounded px-3 py-1.5 text-sm font-medium transition-colors disabled:opacity-50 ${
                                rhythm === value ? "bg-ink text-white" : "text-ink-soft hover:bg-hover"
                            }`}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Bedside monitor, printing onto paper */}
            <div className="ecg-paper relative overflow-hidden rounded-lg border border-line">
                <div className="pointer-events-none absolute inset-x-4 top-3 z-10 flex items-start justify-between">
                    <p className="text-sm text-ink-soft">{patientName ?? "Anonymous"}</p>
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setSoundEnabled(!soundEnabled)}
                            aria-pressed={soundEnabled}
                            className="pointer-events-auto rounded border border-line bg-sheet px-2 py-0.5 text-xs text-ink-soft hover:text-ink"
                        >
                            {soundEnabled ? "Sound on" : "Sound off"}
                        </button>
                        <div className="flex items-baseline gap-1.5 rounded bg-sheet/85 px-2 py-0.5">
                            <svg className={`size-3.5 self-center transition-transform duration-75 ${isBeeping ? "scale-125" : "opacity-40"}`} viewBox="0 0 24 24" fill="var(--color-afib)" aria-hidden>
                                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                            </svg>
                            <span className="figure text-2xl">{isSimulating && heartRate > 0 ? heartRate : "--"}</span>
                            <span className="text-xs text-ink-soft">bpm</span>
                        </div>
                    </div>
                </div>
                <canvas ref={canvasRef} width={700} height={200} className="block h-48 w-full" aria-label="Simulated ECG monitor" role="img" />
                <div className="absolute inset-x-0 bottom-0 h-1 bg-line" aria-hidden>
                    <div className="h-full bg-ink transition-[width] duration-200" style={{ width: `${progress}%` }} />
                </div>
            </div>

            {!patientName && (
                <fieldset className="space-y-3 rounded-lg border border-line p-4">
                    <legend className="px-1 text-sm font-semibold">Details for the stroke risk score</legend>
                    <div className="flex flex-wrap items-end gap-4">
                        <label className="text-sm">
                            <span className="block text-ink-soft">Age</span>
                            <input type="number" min={0} max={120} value={simAge} onChange={e => setSimAge(Number(e.target.value))}
                                className="mt-1 w-24 rounded-md border border-line bg-sheet px-2 py-1.5" />
                        </label>
                        <label className="text-sm">
                            <span className="block text-ink-soft">Sex</span>
                            <select value={simGender} onChange={e => setSimGender(e.target.value)} className="mt-1 rounded-md border border-line bg-sheet px-2 py-1.5">
                                <option value="male">Male</option>
                                <option value="female">Female</option>
                            </select>
                        </label>
                        <p className="pb-1.5 text-sm">
                            CHA₂DS₂-VASc <span className="font-semibold">{calculatedScore}</span>, {riskCategory}
                        </p>
                    </div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                        {checkbox("Heart failure (+1)", simCHF, setSimCHF)}
                        {checkbox("Hypertension (+1)", simHTN, setSimHTN)}
                        {checkbox("Diabetes (+1)", simDM, setSimDM)}
                        {checkbox("Stroke or TIA (+2)", simStroke, setSimStroke)}
                        {checkbox("Vascular disease (+1)", simVascular, setSimVascular)}
                    </div>
                </fieldset>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex gap-2">
                    <button
                        onClick={isSimulating ? () => setIsSimulating(false) : startSimulation}
                        className="rounded-md border border-ink px-4 py-2 text-sm font-medium hover:bg-hover"
                    >
                        {isSimulating ? "Pause" : simulationCompleted ? "Record again" : progress > 0 ? "Resume" : "Start recording"}
                    </button>
                    <button onClick={resetSimulation} disabled={progress === 0} className="rounded-md px-4 py-2 text-sm text-ink-soft hover:bg-hover disabled:opacity-40">
                        Reset
                    </button>
                </div>
                <button
                    onClick={handleAnalyze}
                    disabled={!simulationCompleted}
                    className="rounded-md bg-ink px-5 py-2 text-sm font-medium text-white hover:bg-ink/85 disabled:cursor-not-allowed disabled:opacity-40"
                >
                    {simulationCompleted || progress === 0 ? "Analyze strip" : `Recording ${progress}%`}
                </button>
            </div>
        </div>
    );
}
