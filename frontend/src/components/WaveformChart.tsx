import { useEffect, useMemo, useRef, useState } from "react";
import { Line } from "react-chartjs-2";
import { Chart as ChartJS, LinearScale, PointElement, LineElement, type Plugin } from "chart.js";
import zoomPlugin from "chartjs-plugin-zoom";
import { AF_THRESHOLD } from "../tiers";

ChartJS.register(LinearScale, PointElement, LineElement, zoomPlugin);

const FS = 250;           // samples per second
const LEAD_IN = 0.4;      // seconds of blank paper before the trace, room for the calibration pulse
const BOX_S = 0.04;       // one 1 mm box is 0.04 s at 25 mm/s...
const BOX_MV = 0.1;       // ...and 0.1 mV at 10 mm/mV
const TRACKS_H = 50;      // px below the paper for the rhythm and model-focus tracks
const REVEAL_MS = 900;

interface Props {
    signal: number[];
    rPeaks?: number[];
    gradCam?: number[];
    windowProbs?: number[];
}

const cssVar = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

export default function WaveformChart({ signal, rPeaks, gradCam, windowProbs }: Props) {
    const chartRef = useRef<ChartJS<"line"> | null>(null);
    const revealRef = useRef(1);
    const [speed, setSpeed] = useState(25);

    const duration = signal.length / FS;
    const fullSpan = duration + LEAD_IN;
    const afibWindows = windowProbs?.filter(p => p >= AF_THRESHOLD).length ?? 0;

    const points = useMemo(() => signal.map((v, i) => ({ x: i / FS, y: v })), [signal]);
    const { baseline, center } = useMemo(() => {
        const sorted = [...signal].sort((a, b) => a - b);
        return {
            baseline: sorted[Math.floor(sorted.length / 2)] ?? 0,
            center: ((sorted[0] ?? 0) + (sorted[sorted.length - 1] ?? 0)) / 2,
        };
    }, [signal]);

    // Everything drawn on the canvas besides the trace lives in this one plugin, so it pans and zooms with it
    const paperPlugin = useMemo<Plugin<"line">>(() => {
        const c = {
            ink: cssVar("--color-ink"), soft: cssVar("--color-ink-soft"), faint: cssVar("--color-ink-faint"),
            paper: cssVar("--color-paper"), minor: cssVar("--color-grid-minor"), major: cssVar("--color-grid-major"),
            afib: cssVar("--color-afib"), line: cssVar("--color-line"),
        };
        const boxPx = (chart: ChartJS) => chart.chartArea.width / (fullSpan / BOX_S); // 25 mm/s at full view

        return {
            id: "ecgPaper",
            // Keep boxes square: the vertical range follows from the box size so 1 mV is always 10 boxes
            afterLayout(chart) {
                const a = chart.chartArea;
                if (!a || a.width <= 0) return;
                const span = (a.height / boxPx(chart)) * BOX_MV;
                const y = chart.options.scales!.y!;
                const min = center - span / 2;
                if (Math.abs(Number(y.min ?? 0) - min) > 1e-6) {
                    y.min = min;
                    y.max = min + span;
                    chart.update("none");
                }
            },
            beforeDraw(chart) {
                const { ctx, chartArea: a, scales: { x, y } } = chart;
                const box = boxPx(chart);
                ctx.save();
                ctx.fillStyle = c.paper;
                ctx.fillRect(a.left, a.top, a.width, a.height);
                ctx.beginPath();
                ctx.rect(a.left, a.top, a.width, a.height);
                ctx.clip();

                // Grid in paper space: anchored to the start of the strip so it slides when panned
                const x0 = x.getPixelForValue(-LEAD_IN);
                for (const major of box >= 3 ? [false, true] : [true]) {
                    ctx.strokeStyle = major ? c.major : c.minor;
                    ctx.lineWidth = 1;
                    ctx.beginPath();
                    for (let k = Math.ceil((a.left - x0) / box); x0 + k * box <= a.right; k++) {
                        if ((k % 5 === 0) !== major) continue;
                        const px = Math.round(x0 + k * box) + 0.5;
                        ctx.moveTo(px, a.top);
                        ctx.lineTo(px, a.bottom);
                    }
                    for (let j = 0; a.bottom - j * box >= a.top; j++) {
                        if ((j % 5 === 0) !== major) continue;
                        const py = Math.round(a.bottom - j * box) + 0.5;
                        ctx.moveTo(a.left, py);
                        ctx.lineTo(a.right, py);
                    }
                    ctx.stroke();
                }

                // Calibration pulse: 1 mV high, 0.2 s (5 boxes) wide
                const base = y.getPixelForValue(baseline);
                const top = y.getPixelForValue(baseline + 1);
                const p0 = x0 + box * 1.5;
                ctx.strokeStyle = c.ink;
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.moveTo(p0, base);
                ctx.lineTo(p0 + box, base);
                ctx.lineTo(p0 + box, top);
                ctx.lineTo(p0 + box * 6, top);
                ctx.lineTo(p0 + box * 6, base);
                ctx.lineTo(p0 + box * 7.5, base);
                ctx.stroke();
                ctx.restore();
            },
            // Reveal: the trace, calipers and tracks print left to right once per strip
            beforeDatasetsDraw(chart) {
                const { ctx, chartArea: a } = chart;
                ctx.save();
                ctx.beginPath();
                ctx.rect(a.left, 0, a.width * revealRef.current, chart.height);
                ctx.clip();
            },
            afterDatasetsDraw(chart) {
                const { ctx, chartArea: a, scales: { x } } = chart;
                const visible = (t: number) => {
                    const px = x.getPixelForValue(t);
                    return px >= a.left && px <= a.right;
                };
                ctx.font = "500 10px Archivo, sans-serif";
                ctx.textAlign = "center";
                ctx.textBaseline = "top";

                // Calipers: time between consecutive beats, in ms
                const peaks = rPeaks ?? [];
                ctx.strokeStyle = c.faint;
                ctx.lineWidth = 1;
                for (let i = 0; i < peaks.length; i++) {
                    const t = peaks[i] / FS;
                    if (!visible(t)) continue;
                    const px = Math.round(x.getPixelForValue(t)) + 0.5;
                    ctx.beginPath();
                    ctx.moveTo(px, a.top + 16);
                    ctx.lineTo(px, a.top + 24);
                    ctx.stroke();
                    if (i === 0) continue;
                    const prev = x.getPixelForValue(peaks[i - 1] / FS);
                    ctx.beginPath();
                    ctx.moveTo(prev, a.top + 20);
                    ctx.lineTo(px, a.top + 20);
                    ctx.stroke();
                    if (px - prev > 30) {
                        ctx.fillStyle = c.soft;
                        ctx.fillText(String(Math.round(((peaks[i] - peaks[i - 1]) * 1000) / FS)), (prev + px) / 2, a.top + 4);
                    }
                }

                // Rhythm track: one cell per 2 s window the model classified
                const rowY = a.bottom + 8;
                (windowProbs ?? []).forEach((p, w) => {
                    const l = Math.max(a.left, x.getPixelForValue(w * 2)) + 1;
                    const r = Math.min(a.right, x.getPixelForValue(w * 2 + 2)) - 1;
                    if (r <= l) return;
                    const afib = p >= AF_THRESHOLD;
                    ctx.fillStyle = afib ? c.afib : c.line;
                    ctx.fillRect(l, rowY, r - l, 18);
                    if (r - l > 36) {
                        ctx.fillStyle = afib ? "#FFFFFF" : c.soft;
                        ctx.fillText(`${Math.round(p * 100)}%`, (l + r) / 2, rowY + 4);
                    }
                });

                // Model focus track: Grad-CAM intensity under each sample
                const camY = a.bottom + 30;
                if (gradCam?.length) {
                    for (let px = a.left; px < a.right; px += 2) {
                        const v = gradCam[Math.round(x.getValueForPixel(px)! * FS)];
                        if (!v) continue;
                        ctx.globalAlpha = Math.min(1, v);
                        ctx.fillStyle = c.ink;
                        ctx.fillRect(px, camY, 2, 6);
                    }
                    ctx.globalAlpha = 1;
                }

                // Seconds
                ctx.fillStyle = c.faint;
                const pxPerSec = x.getPixelForValue(1) - x.getPixelForValue(0);
                const step = pxPerSec < 28 ? 2 : 1;
                for (let s = 0; s <= duration; s += step) {
                    const px = x.getPixelForValue(s);
                    if (visible(s) && px < a.right - 8) ctx.fillText(s === 0 ? "0 s" : String(s), px, a.bottom + 40);
                }
                ctx.restore();
            },
        };
    }, [baseline, center, fullSpan, duration, rPeaks, gradCam, windowProbs]);

    // Print the strip once when a new signal arrives
    useEffect(() => {
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        if (reduce) {
            revealRef.current = 1;
            chartRef.current?.draw();
            return;
        }
        revealRef.current = 0;
        let frame = 0;
        const start = performance.now();
        const tick = (now: number) => {
            revealRef.current = Math.min(1, (now - start) / REVEAL_MS);
            chartRef.current?.draw();
            if (revealRef.current < 1) frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(frame);
    }, [signal]);

    const updateSpeed = (chart: ChartJS) => {
        const { min, max } = chart.scales.x;
        setSpeed(Math.round((25 * fullSpan) / (max - min)));
    };

    const setPaperSpeed = (mmPerSec: 25 | 50) => {
        const chart = chartRef.current;
        if (!chart) return;
        if (mmPerSec === 25) {
            chart.resetZoom("none");
        } else {
            const min = Math.max(-LEAD_IN, chart.scales.x.min);
            chart.zoomScale("x", { min, max: min + fullSpan / 2 }, "none");
        }
        updateSpeed(chart);
    };

    return (
        <figure className="m-0">
            <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 px-1 pb-3">
                <figcaption className="text-sm text-ink-soft">
                    {duration.toFixed(0)}-second strip, {speed} mm/s, 10 mm/mV
                </figcaption>
                <div className="flex items-center gap-3">
                    <span className="hidden text-xs text-ink-faint sm:inline">Drag to pan, Ctrl + scroll to zoom</span>
                    <div className="flex rounded-md border border-line bg-sheet p-0.5" role="group" aria-label="Paper speed">
                        {([25, 50] as const).map(s => (
                            <button
                                key={s}
                                onClick={() => setPaperSpeed(s)}
                                aria-pressed={speed === s}
                                className={`rounded px-2.5 py-1 text-xs font-medium transition-colors ${
                                    speed === s ? "bg-ink text-white" : "text-ink-soft hover:bg-hover"
                                }`}
                            >
                                {s} mm/s
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div
                className="h-72 cursor-grab active:cursor-grabbing"
                role="img"
                aria-label={`ECG strip, ${duration.toFixed(0)} seconds, ${rPeaks?.length ?? 0} beats detected${
                    windowProbs?.length ? `, AFib in ${afibWindows} of ${windowProbs.length} two-second windows` : ""
                }`}
            >
                <Line
                    ref={chartRef}
                    data={{ datasets: [{ data: points, borderColor: cssVar("--color-ink"), borderWidth: 1.4, pointRadius: 0, tension: 0 }] }}
                    plugins={[paperPlugin]}
                    options={{
                        responsive: true,
                        maintainAspectRatio: false,
                        animation: false,
                        parsing: false,
                        normalized: true,
                        events: ["mousedown", "mouseup", "mousemove", "mouseout", "touchstart", "touchmove", "touchend", "wheel"],
                        layout: { padding: { bottom: TRACKS_H } },
                        plugins: {
                            legend: { display: false },
                            tooltip: { enabled: false },
                            zoom: {
                                limits: { x: { min: -LEAD_IN, max: duration, minRange: 1 } },
                                pan: { enabled: true, mode: "x", onPanComplete: ({ chart }) => updateSpeed(chart) },
                                zoom: {
                                    wheel: { enabled: true, modifierKey: "ctrl" },
                                    pinch: { enabled: true },
                                    mode: "x",
                                    onZoomComplete: ({ chart }) => updateSpeed(chart),
                                },
                            },
                        },
                        scales: {
                            x: { type: "linear", display: false, min: -LEAD_IN, max: duration },
                            y: { type: "linear", display: false },
                        },
                    }}
                />
            </div>

            <div className="flex flex-wrap gap-x-5 gap-y-1.5 px-1 pt-2 text-xs text-ink-soft">
                {windowProbs?.length ? (
                    <>
                        <span className="flex items-center gap-1.5">
                            <span className="h-2.5 w-4 bg-afib" aria-hidden /> AFib in this 2-second window
                        </span>
                        <span className="flex items-center gap-1.5">
                            <span className="h-2.5 w-4 bg-line" aria-hidden /> No AFib
                        </span>
                    </>
                ) : null}
                {gradCam?.length ? (
                    <span className="flex items-center gap-1.5">
                        <span className="h-1.5 w-4 bg-linear-to-r from-transparent to-ink" aria-hidden /> Where the model looked
                    </span>
                ) : null}
                <span>Numbers above the beats: time between beats in ms</span>
            </div>
        </figure>
    );
}
