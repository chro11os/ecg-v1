import { useEffect, useRef } from "react";
import Chart from "chart.js/auto";
import type { DiagnosisData, BurdenTier, Patient } from "../types";
import { TIERS } from "../tiers";
import { exportReport } from "../utils/exportReport";
import { getCHA2DS2VAScBreakdown, getStrokeRiskCategory } from "../utils/strokeRisk";
import WaveformChart from "./WaveformChart";

interface Props {
    data: DiagnosisData;
    onReset: () => void;
    patientScans?: any[];
    activePatient?: Patient;
    onUpdateScan?: (scanId: number, newClass: number, patientId: string) => Promise<void>;
}

const FS = 250;

export default function DiagnosisDashboard({ data, onReset, patientScans, activePatient, onUpdateScan }: Props) {
    const trendRef = useRef<HTMLCanvasElement | null>(null);
    const tier = TIERS[data.burdenTier];
    const peaks = data.rPeaks ?? [];
    const heartRate = peaks.length > 1 ? Math.round((60 * FS * (peaks.length - 1)) / (peaks[peaks.length - 1] - peaks[0])) : null;
    const risk = data.strokeRiskScore !== undefined ? getStrokeRiskCategory(data.strokeRiskScore) : null;

    // Burden over time, from each scan's measured burden
    useEffect(() => {
        if (!trendRef.current || !patientScans?.length) return;
        const scans = [...patientScans].sort((a, b) => a.timestamp.localeCompare(b.timestamp));
        const css = getComputedStyle(document.documentElement);
        const afib = css.getPropertyValue("--color-afib").trim();
        const soft = css.getPropertyValue("--color-ink-soft").trim();
        const line = css.getPropertyValue("--color-line").trim();
        const chart = new Chart(trendRef.current, {
            type: "line",
            data: {
                labels: scans.map(s => {
                    const d = new Date(s.timestamp.replace(" ", "T"));
                    return isNaN(d.getTime()) ? s.timestamp : d.toLocaleDateString([], { month: "short", day: "numeric" });
                }),
                datasets: [{
                    data: scans.map(s => s.afib_burden ?? null),
                    borderColor: afib,
                    backgroundColor: afib,
                    borderWidth: 2,
                    pointRadius: 3,
                    spanGaps: true,
                    tension: 0,
                }],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: false,
                plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => `${c.parsed.y}% AFib` } } },
                scales: {
                    y: { min: 0, max: 100, border: { display: false }, grid: { color: line }, ticks: { color: soft, stepSize: 50, callback: v => `${v}%` } },
                    x: { grid: { display: false }, ticks: { color: soft, maxRotation: 0, autoSkip: true, maxTicksLimit: 6 } },
                },
            },
        });
        return () => chart.destroy();
    }, [patientScans]);

    return (
        <div className="space-y-4">
            {/* Printout header: who, what and the result */}
            <section className="grid gap-x-10 gap-y-6 rounded-xl border border-line bg-sheet p-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]">
                <div className="flex flex-col justify-between gap-6">
                    <div>
                        <h1 className="text-2xl font-semibold" style={{ fontStretch: "110%" }}>
                            {activePatient ? activePatient.name : "Anonymous scan"}
                        </h1>
                        <p className="mt-1 text-ink-soft">
                            {activePatient
                                ? `${activePatient.id}, ${activePatient.gender}, ${activePatient.age} years`
                                : "Not linked to a patient"}
                        </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <button onClick={onReset} className="rounded-md bg-ink px-4 py-2 text-sm font-medium text-white hover:bg-ink/85">
                            New recording
                        </button>
                        <button onClick={() => exportReport(data, activePatient)} className="rounded-md border border-line px-4 py-2 text-sm font-medium hover:bg-hover">
                            Print report
                        </button>
                        {data.id && data.patientId && onUpdateScan && (
                            <label className="flex items-center gap-2 text-sm text-ink-soft">
                                Clinician override
                                <select
                                    value={data.burdenTier}
                                    onChange={async e => {
                                        const next = Number(e.target.value);
                                        if (window.confirm(`Change this scan's tier to "${TIERS[next as BurdenTier].name}"? The measured burden stays as recorded.`)) {
                                            await onUpdateScan(data.id!, next, data.patientId!);
                                        }
                                    }}
                                    className="rounded-md border border-line bg-sheet px-2 py-1.5 text-sm text-ink"
                                >
                                    {([0, 1, 2, 3] as const).map(t => <option key={t} value={t}>{TIERS[t].name}</option>)}
                                </select>
                            </label>
                        )}
                    </div>
                </div>

                <div>
                    <p className="text-sm text-ink-soft">AFib burden</p>
                    <div className="mt-1 flex items-end gap-4">
                        <span className="figure text-7xl" style={{ color: data.burdenTier === 0 || data.burden == null ? "var(--color-ink)" : tier.color }}>
                            {data.burden == null ? "–" : `${Math.round(data.burden)}%`}
                        </span>
                        <div className="pb-1">
                            <p className="text-lg font-semibold leading-tight">{tier.name}</p>
                            <p className="text-sm text-ink-soft">{tier.detail}</p>
                            <p className="text-sm text-ink-soft">Model confidence {data.confidence}%</p>
                        </div>
                    </div>
                    {data.burden == null ? (
                        <p className="mt-4 text-sm text-ink-soft">This scan was made before burden was measured, so only its tier is known.</p>
                    ) : (
                        <BurdenScale burden={data.burden} />
                    )}
                </div>
            </section>

            {/* The strip */}
            <section className="rounded-xl border border-line bg-sheet p-5">
                <WaveformChart signal={data.rawSignal} rPeaks={data.rPeaks} gradCam={data.gradCam} windowProbs={data.windowProbs} />
                <p className="mt-3 border-t border-line pt-3 text-xs text-ink-faint">
                    {data.responseTime > 0
                        ? `Analyzed in ${data.responseTime} ms on ${data.hardware}. Burden is the share of 2-second windows the model classified as AFib.`
                        : "Loaded from the patient record. Burden is the share of 2-second windows the model classified as AFib."}
                </p>
            </section>

            {/* Report sheet */}
            <section className="grid rounded-xl border border-line bg-sheet md:grid-cols-3 md:divide-x md:divide-line">
                <div className="p-5">
                    <h2 className="font-semibold">Rhythm</h2>
                    <dl className="mt-4 space-y-3">
                        <Stat label="Heart rate" value={heartRate ? `${heartRate} bpm` : "Not enough beats"} />
                        <Stat label="Beats detected" value={String(peaks.length)} />
                        <Stat label="Beat-to-beat variation (RMSSD)" value={`${data.rmssd ?? 0} ms`} />
                        <Stat label="R-R variance" value={`${data.rrVariance ?? 0} ms²`} />
                    </dl>
                    <p className="mt-4 text-sm text-ink-soft">
                        Irregular spacing between beats is one sign of AFib. The model also reads the waveform's shape, such as missing P waves.
                    </p>
                </div>

                <div className="border-t border-line p-5 md:border-t-0">
                    <h2 className="font-semibold">Stroke risk</h2>
                    {risk ? (
                        <>
                            <div className="mt-4 flex items-baseline gap-3">
                                <span className="figure text-5xl">{data.strokeRiskScore}</span>
                                <div>
                                    <p className="font-semibold leading-tight">{risk.label}</p>
                                    <p className="text-sm text-ink-soft">CHA₂DS₂-VASc score</p>
                                </div>
                            </div>
                            <p className="mt-3 text-sm">{risk.rec}</p>
                            {activePatient && (
                                <ul className="mt-4 space-y-1 text-sm">
                                    {getCHA2DS2VAScBreakdown(activePatient).map(item => (
                                        <li key={item.criteria} className={`flex justify-between ${item.active ? "font-medium" : "text-ink-faint"}`}>
                                            <span>{item.criteria}</span>
                                            <span>{item.active ? `+${item.pts}` : "0"}</span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </>
                    ) : (
                        <p className="mt-4 text-sm text-ink-soft">Select or register a patient to calculate their stroke risk.</p>
                    )}
                </div>

                <div className="border-t border-line p-5 md:border-t-0">
                    <h2 className="font-semibold">Burden over time</h2>
                    {patientScans?.length ? (
                        <>
                            <p className="mt-1 text-sm text-ink-soft">{patientScans.length} {patientScans.length === 1 ? "scan" : "scans"} for this patient</p>
                            <div className="relative mt-4 h-44"><canvas ref={trendRef} aria-label="AFib burden per scan over time" role="img" /></div>
                        </>
                    ) : (
                        <p className="mt-4 text-sm text-ink-soft">Scans saved to a patient show up here as a trend.</p>
                    )}
                </div>
            </section>
        </div>
    );
}

function Stat({ label, value }: { label: string; value: string }) {
    return (
        <div className="flex items-baseline justify-between gap-4">
            <dt className="text-sm text-ink-soft">{label}</dt>
            <dd className="font-semibold">{value}</dd>
        </div>
    );
}

// 0-100% with the tier boundaries at 0, 5 and 50%, and a marker where this scan landed
function BurdenScale({ burden }: { burden: number }) {
    const pos = Math.min(100, Math.max(0, burden));
    return (
        <div className="mt-5" aria-hidden>
            <div className="relative h-2.5">
                <div className="absolute inset-0 flex">
                    <div className="h-full bg-tier-1" style={{ width: "5%" }} />
                    <div className="h-full bg-tier-2" style={{ width: "45%" }} />
                    <div className="h-full bg-tier-3" style={{ width: "50%" }} />
                </div>
                <div className="absolute -top-1.5 h-5.5 w-0.5 -translate-x-1/2 bg-ink" style={{ left: `${pos}%` }} />
            </div>
            <div className="relative mt-1.5 h-4 text-xs text-ink-soft">
                {[0, 5, 50, 100].map(v => (
                    <span key={v} className={`absolute ${v === 0 ? "" : v === 100 ? "-translate-x-full" : "-translate-x-1/2"}`} style={{ left: `${v}%` }}>
                        {v === 100 ? "100%" : v}
                    </span>
                ))}
            </div>
        </div>
    );
}
