import { useState, useEffect, useRef } from "react";
import { generateECGData } from "../utils/ecgSimulator";

interface ECGSimulatorPanelProps {
    onAnalyze: (signal: number[], fileName: string) => void;
    patientName?: string;
}

export default function ECGSimulatorPanel({ onAnalyze, patientName }: ECGSimulatorPanelProps) {
    const [rhythm, setRhythm] = useState<"normal" | "afib">("normal");
    const [isSimulating, setIsSimulating] = useState(false);
    const [progress, setProgress] = useState(0); // 0 to 100
    const [heartRate, setHeartRate] = useState(75);
    const [isBeeping, setIsBeeping] = useState(false);
    const [soundEnabled, setSoundEnabled] = useState(false);
    const [simulationCompleted, setSimulationCompleted] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [terminalLogs, setTerminalLogs] = useState<string[]>([]);

    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const animationRef = useRef<number | null>(null);
    const audioCtxRef = useRef<AudioContext | null>(null);

    // Simulated data storage
    const simulatedSignalRef = useRef<number[]>([]);
    const simulatedPeaksRef = useRef<number[]>([]);
    const currentIdxRef = useRef<number>(0);
    const lastTimeRef = useRef<number>(0);
    const lastBeatIndexRef = useRef<number>(-1);

    // Generate new ECG signal
    const initializeSignal = () => {
        const { signal, rPeaks } = generateECGData(rhythm, 2500);
        simulatedSignalRef.current = signal;
        simulatedPeaksRef.current = rPeaks;
        currentIdxRef.current = 0;
        lastBeatIndexRef.current = -1;
        setSimulationCompleted(false);
        setProgress(0);
        setHeartRate(rhythm === "normal" ? 75 : 85);
        
        // Clear canvas
        drawEmptyGrid();
    };

    useEffect(() => {
        initializeSignal();
        return () => {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
        };
    }, [rhythm]);

    // Draw empty grid
    const drawEmptyGrid = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        // Clear canvas
        ctx.fillStyle = "#0A0F1D";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw grid
        ctx.strokeStyle = "#14253D";
        ctx.lineWidth = 0.5;

        // Vertical lines
        for (let x = 0; x < canvas.width; x += 20) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, canvas.height);
            ctx.stroke();
        }

        // Horizontal lines
        for (let y = 0; y < canvas.height; y += 20) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(canvas.width, y);
            ctx.stroke();
        }
    };

    // Play heart rate beep sound
    const playBeep = () => {
        if (!soundEnabled) return;
        try {
            if (!audioCtxRef.current) {
                audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
            }
            const ctx = audioCtxRef.current;
            if (ctx.state === "suspended") {
                ctx.resume();
            }

            const osc = ctx.createOscillator();
            const gain = ctx.createGain();

            osc.type = "sine";
            osc.frequency.setValueAtTime(450, ctx.currentTime); // Pitch
            gain.gain.setValueAtTime(0.06, ctx.currentTime);    // Volume

            // Beep duration
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
            osc.connect(gain);
            gain.connect(ctx.destination);

            osc.start();
            osc.stop(ctx.currentTime + 0.08);
        } catch (e) {
            console.error("Audio error", e);
        }
    };

    // Animation Loop
    const animate = (timestamp: number) => {
        if (!lastTimeRef.current) lastTimeRef.current = timestamp;
        const elapsed = timestamp - lastTimeRef.current;
        lastTimeRef.current = timestamp;

        const canvas = canvasRef.current;
        if (!canvas || !isSimulating) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const signal = simulatedSignalRef.current;
        const rPeaks = simulatedPeaksRef.current;
        const totalSamples = signal.length;

        // Determine how many samples to write this frame based on elapsed time (250Hz sample rate)
        // 250 samples per 1000ms = 0.25 samples per ms
        const samplesToAdvance = Math.max(1, Math.round(elapsed * 0.25));
        const startIdx = currentIdxRef.current;
        const endIdx = Math.min(totalSamples, startIdx + samplesToAdvance);

        // Grid parameters
        const gridCols = 750; // number of samples shown on screen at once (3.0 seconds)
        const centerY = canvas.height / 2;
        const scaleY = canvas.height * 0.45; // scaling factor for signal height

        for (let i = startIdx; i < endIdx; i++) {
            const screenPos = i % gridCols;

            // Draw grid segment background to erase old line
            const colWidth = canvas.width / gridCols;
            const x = screenPos * colWidth;
            
            // Clear ahead (erase gap of 35 samples)
            ctx.fillStyle = "#0A0F1D";
            ctx.fillRect(x, 0, colWidth * 35, canvas.height);

            // Redraw background grid lines for the cleared area
            ctx.strokeStyle = "#14253D";
            ctx.lineWidth = 0.5;
            
            // Draw single vertical grid line if aligned
            const gridAlign = Math.round(x) % 20;
            if (gridAlign >= 0 && gridAlign < colWidth * 35) {
                ctx.beginPath();
                ctx.moveTo(x, 0);
                ctx.lineTo(x, canvas.height);
                ctx.stroke();
            }

            // Draw ECG trace segment
            if (i > 0) {
                const prevScreenPos = (i - 1) % gridCols;
                
                // Do not draw lines wrapping from right edge back to left edge
                if (prevScreenPos < screenPos) {
                    const prevX = prevScreenPos * colWidth;
                    const prevY = centerY - (signal[i - 1] * scaleY);
                    const currY = centerY - (signal[i] * scaleY);

                    ctx.beginPath();
                    ctx.moveTo(prevX, prevY);
                    ctx.lineTo(x, currY);
                    ctx.strokeStyle = "#00FF66"; // Neon green
                    ctx.shadowColor = "#00FF66";
                    ctx.shadowBlur = 4;
                    ctx.lineWidth = 2.0;
                    ctx.stroke();
                    ctx.shadowBlur = 0; // reset shadow
                }
            }

            // Check if this sample is an R-peak (beat trigger)
            const peakIndex = rPeaks.indexOf(i);
            if (peakIndex !== -1 && i !== lastBeatIndexRef.current) {
                lastBeatIndexRef.current = i;
                setIsBeeping(true);
                playBeep();
                setTimeout(() => setIsBeeping(false), 150);

                // Update heart rate display with some physiological variation
                if (rhythm === "normal") {
                    setHeartRate(72 + Math.round(Math.random() * 6));
                } else {
                    // AFib displays high variability beat-to-beat
                    setHeartRate(80 + Math.round(Math.random() * 70));
                }
            }
        }

        currentIdxRef.current = endIdx;
        const currentProgress = (endIdx / totalSamples) * 100;
        setProgress(Math.round(currentProgress));

        if (endIdx >= totalSamples) {
            setIsSimulating(false);
            setSimulationCompleted(true);
            setHeartRate(0);
        } else {
            animationRef.current = requestAnimationFrame(animate);
        }
    };

    const startSimulation = () => {
        if (simulationCompleted) {
            initializeSignal();
        }
        setIsSimulating(true);
        lastTimeRef.current = 0;
    };

    useEffect(() => {
        if (isSimulating) {
            animationRef.current = requestAnimationFrame(animate);
        } else {
            if (animationRef.current) {
                cancelAnimationFrame(animationRef.current);
            }
        }
        return () => {
            if (animationRef.current) cancelAnimationFrame(animationRef.current);
        };
    }, [isSimulating]);

    const stopSimulation = () => {
        setIsSimulating(false);
    };

    const resetSimulation = () => {
        setIsSimulating(false);
        initializeSignal();
    };

    const handleAnalyze = () => {
        if (simulatedSignalRef.current.length > 0) {
            setIsAnalyzing(true);
            setTerminalLogs([]);
            
            const logs = [
                "[SYSTEM] Initializing diagnostic CDSS pipeline...",
                "[DSP] Applying Butterworth bandpass filter (0.5Hz - 45Hz)... OK",
                "[MODEL] Loading 1D CNN-LSTM neural network weights... OK",
                "[MODEL] Executing GPU accelerated forward pass... OK",
                "[XAI] Calculating Conv1D gradients & Grad-CAM activations... OK",
                "[SYSTEM] Analysis complete. Redirecting to diagnostics... OK"
            ];
            
            logs.forEach((log, index) => {
                setTimeout(() => {
                    setTerminalLogs(prev => [...prev, log]);
                    
                    if (index === logs.length - 1) {
                        setTimeout(() => {
                            setIsAnalyzing(false);
                            const fileName = `simulated_${rhythm}_${Date.now().toString().slice(-6)}.json`;
                            onAnalyze(simulatedSignalRef.current, fileName);
                        }, 400);
                    }
                }, (index + 1) * 350);
            });
        }
    };

    return (
        <div className="bg-card-bg border border-border-subtle p-6 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-border-subtle">
                <div>
                    <h3 className="text-xl font-bold text-text-primary">Clinical ECG Simulator</h3>
                    <p className="text-xs text-brand-secondary font-mono">
                        Synthesizes fully standard Lead I ECG signals for diagnostic engine testing
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <span className="text-[10px] font-mono font-bold text-brand-secondary">RHYTHM TYPE:</span>
                    <button
                        onClick={() => { setRhythm("normal"); }}
                        disabled={isSimulating}
                        className={`px-3 py-1 text-xs font-mono font-bold cursor-pointer rounded-none border transition-all active:scale-[0.97] ${
                            rhythm === "normal"
                                ? "bg-status-healthy-light border-status-healthy text-status-healthy"
                                : "bg-bg-canvas border-border-subtle text-brand-secondary hover:text-text-primary disabled:opacity-50"
                        }`}
                    >
                        SINUS RHYTHM
                    </button>
                    <button
                        onClick={() => { setRhythm("afib"); }}
                        disabled={isSimulating}
                        className={`px-3 py-1 text-xs font-mono font-bold cursor-pointer rounded-none border transition-all active:scale-[0.97] ${
                            rhythm === "afib"
                                ? "bg-status-critical-light border-status-critical text-status-critical"
                                : "bg-bg-canvas border-border-subtle text-brand-secondary hover:text-text-primary disabled:opacity-50"
                        }`}
                    >
                        ATRIAL FIBRILLATION
                    </button>
                </div>
            </div>

            {/* Bedside Heart Monitor Screen */}
            <div className="relative bg-[#0A0F1D] border-2 border-slate-800 p-2 shadow-inner overflow-hidden">
                {/* HUD Overlay */}
                <div className="absolute top-4 left-4 right-4 z-10 flex justify-between select-none pointer-events-none font-mono">
                    <div className="text-[#00FF66] text-[10px] space-y-0.5">
                        <div className="font-bold uppercase tracking-wider text-xs">LEAD I CONT.</div>
                        <div>PATIENT: {patientName || "ANONYMOUS SCAN"}</div>
                        <div>MODE: REAL-TIME SIMULATION</div>
                    </div>

                    <div className="flex items-center gap-6">
                        {/* Audio status indicator */}
                        <div 
                            className="pointer-events-auto cursor-pointer text-xs font-bold px-2 py-0.5 border border-slate-700 bg-slate-900 text-slate-400 hover:text-[#00FF66] active:scale-95 transition-all"
                            onClick={() => setSoundEnabled(!soundEnabled)}
                        >
                            {soundEnabled ? "BEEP ON" : "BEEP OFF"}
                        </div>

                        {/* Heart rate monitor widget */}
                        <div className="text-right">
                            <div className="text-slate-500 text-[9px] uppercase tracking-wider">HR (BPM)</div>
                            <div className="flex items-center justify-end gap-2">
                                <span className={`text-2xl font-bold transition-all duration-75 ${
                                    isBeeping 
                                        ? (rhythm === "normal" ? "text-status-healthy scale-110" : "text-status-critical scale-110") 
                                        : "text-[#00FF66]"
                                }`}>
                                    {isSimulating && heartRate > 0 ? heartRate : "--"}
                                </span>
                                <svg className={`w-4.5 h-4.5 transition-transform duration-75 ${
                                    isBeeping ? "scale-125 opacity-100" : "opacity-40"
                                } ${rhythm === "normal" ? "fill-status-healthy text-status-healthy" : "fill-status-critical text-status-critical"}`} viewBox="0 0 24 24">
                                    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
                                </svg>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Sweep Canvas */}
                <canvas
                    ref={canvasRef}
                    width={700}
                    height={200}
                    className="w-full h-48 block"
                />

                {/* Loading / Progress indicator */}
                {isSimulating && (
                    <div className="absolute bottom-4 left-4 right-4 flex items-center gap-3 font-mono text-[10px] text-slate-400 select-none">
                        <div className="w-24 bg-slate-950 h-1.5 border border-slate-800">
                            <div 
                                className="bg-[#00FF66] h-full transition-all duration-300"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                        <div>RECORDING: {progress}% (10.0S RECORDING)</div>
                    </div>
                )}
            </div>

            {/* Console Log Terminal Window */}
            {isAnalyzing && (
                <div className="border border-border-subtle bg-bg-canvas rounded-none shadow-xs font-mono text-[10px] text-text-primary overflow-hidden animate-in fade-in duration-300">
                    <div className="bg-bg-canvas-card border-b border-border-subtle px-3 py-1.5 flex items-center justify-between">
                        <div className="flex gap-1.5 select-none pointer-events-none">
                            <span className="w-2.5 h-2.5 rounded-full bg-status-critical opacity-80" />
                            <span className="w-2.5 h-2.5 rounded-full bg-status-warning opacity-80" />
                            <span className="w-2.5 h-2.5 rounded-full bg-status-healthy opacity-80" />
                        </div>
                        <span className="text-[9px] font-bold text-brand-secondary tracking-wider uppercase select-none">CDSS Pipeline Console</span>
                        <div className="w-12" />
                    </div>
                    <div className="p-3 space-y-1 h-32 overflow-y-auto leading-relaxed select-text bg-bg-canvas">
                        {terminalLogs.map((log, idx) => {
                            const isOk = log.includes("... OK");
                            return (
                                <div key={idx} className="flex items-start gap-1">
                                    <span className="text-brand-secondary shrink-0 select-none">&gt;</span>
                                    <span className={isOk ? "text-status-healthy font-bold" : "text-text-primary"}>
                                        {log}
                                    </span>
                                </div>
                            );
                        })}
                        <div className="flex items-center gap-1">
                            <span className="text-brand-secondary">&gt;</span>
                            <span className="w-1.5 h-3 bg-text-primary animate-pulse" />
                        </div>
                    </div>
                </div>
            )}

            {/* Simulation controls */}
            <div className="flex justify-between items-center gap-4 flex-wrap">
                <div className="flex gap-2">
                    {!isSimulating ? (
                        <button
                            onClick={startSimulation}
                            className="px-6 py-2 bg-status-healthy text-white hover:bg-status-healthy-hover text-xs font-mono font-bold cursor-pointer rounded-none active:scale-[0.98] transition-all"
                        >
                            {simulationCompleted ? "RE-RUN SIMULATION" : "START SIMULATOR"}
                        </button>
                    ) : (
                        <button
                            onClick={stopSimulation}
                            className="px-6 py-2 bg-status-warning text-white hover:bg-status-warning-hover text-xs font-mono font-bold cursor-pointer rounded-none active:scale-[0.98] transition-all"
                        >
                            PAUSE SIMULATION
                        </button>
                    )}
                    <button
                        onClick={resetSimulation}
                        disabled={isSimulating && progress === 0}
                        className="px-4 py-2 bg-bg-canvas hover:bg-border-subtle text-brand-secondary hover:text-text-primary border border-border-subtle text-xs font-mono font-bold cursor-pointer rounded-none disabled:opacity-50 active:scale-[0.98] transition-all"
                    >
                        RESET
                    </button>
                </div>

                {simulationCompleted && (
                    <button
                        onClick={handleAnalyze}
                        disabled={isAnalyzing}
                        className="px-6 py-2 bg-brand-primary text-white hover:bg-brand-primary-hover text-xs font-mono font-bold cursor-pointer rounded-none active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isAnalyzing ? "ANALYSIS IN PROGRESS..." : "ANALYZE SIMULATED SIGNAL"}
                    </button>
                )}
            </div>
        </div>
    );
}
