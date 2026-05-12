import { useState, useRef, useEffect, useCallback } from "react";

interface Segment { startIdx: number; endIdx: number; confidence: number; }

interface Props {
  signal?: number[];
  segments?: Segment[];
  afBurden?: number;
  patientId?: string;
  sampleRate?: number;
}

function generateDemo(): { signal: number[]; segments: Segment[] } {
  const signal: number[] = [];
  let t = 0;
  for (let i = 0; i < 2500; i++) {
    const ph = t % 1, af = i > 600 && i < 1200;
    const p = ph > 0.05 && ph < 0.15 ? 0.15 * Math.sin(Math.PI * ((ph - 0.05) / 0.1)) : 0;
    const r = ph > 0.24 && ph < 0.28 ? 1.2 * Math.sin(Math.PI * ((ph - 0.24) / 0.04)) : 0;
    const tw = ph > 0.38 && ph < 0.55 ? (af ? 0.06 : 0.25) * Math.sin(Math.PI * ((ph - 0.38) / 0.17)) : 0;
    signal.push(p + r + tw + (Math.random() - 0.5) * 0.025);
    t += (1 / 500) * (1 + (af ? (Math.random() - 0.5) * 0.35 : (Math.random() - 0.5) * 0.04)) * (af ? 1.3 : 1);
  }
  return {
    signal,
    segments: [
      { startIdx: 620, endIdx: 1180, confidence: 0.91 },
      { startIdx: 1800, endIdx: 1960, confidence: 0.74 },
    ],
  };
}

export default function ECGViewer({
  signal: ps,
  segments: psg,
  afBurden = 0.27,
  patientId = "PT-00421",
  sampleRate = 500,
}: Props) {
  const demo = generateDemo();
  const signal = ps ?? demo.signal;
  const segments = psg ?? demo.segments;
  const total = signal.length;

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [vStart, setVStart] = useState(0);
  const [vWin, setVWin] = useState(total);
  const [showAnnot, setShowAnnot] = useState(true);
  const drag = useRef<{ x: number; v: number } | null>(null);

  const draw = useCallback(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d")!;
    const dpr = devicePixelRatio;
    const W = cv.clientWidth, H = cv.clientHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    ctx.scale(dpr, dpr);

    const PL = 36, PR = 8, PT = 10, PB = 20;
    const pw = W - PL - PR, ph = H - PT - PB;
    const dark = matchMedia("(prefers-color-scheme:dark)").matches;
    const vEnd = Math.min(vStart + vWin, total);
    const sl = signal.slice(vStart, vEnd);
    const dur = sl.length / sampleRate, pps = pw / dur;
    const mn = -0.5, mx = 1.5, ppm = ph / (mx - mn);
    const tx = (i: number) => PL + (i / sl.length) * pw;
    const ty = (v: number) => PT + ph - (v - mn) * ppm;

    ctx.fillStyle = dark ? "#111" : "#fff";
    ctx.fillRect(0, 0, W, H);

    // small grid
    ctx.strokeStyle = dark ? "rgba(255,60,60,.1)" : "rgba(220,50,50,.13)";
    ctx.lineWidth = 0.5;
    for (let t = 0; t <= dur + 0.04; t += 0.04) {
      const x = PL + t * pps; if (x > PL + pw + 1) break;
      ctx.beginPath(); ctx.moveTo(x, PT); ctx.lineTo(x, PT + ph); ctx.stroke();
    }
    for (let v = mn; v <= mx + 0.1; v += 0.1) {
      const y = ty(v); if (y < PT - 1) break;
      ctx.beginPath(); ctx.moveTo(PL, y); ctx.lineTo(PL + pw, y); ctx.stroke();
    }

    // large grid
    ctx.strokeStyle = dark ? "rgba(255,60,60,.22)" : "rgba(220,50,50,.28)";
    ctx.lineWidth = 1;
    for (let t = 0; t <= dur + 0.2; t += 0.2) {
      const x = PL + t * pps; if (x > PL + pw + 1) break;
      ctx.beginPath(); ctx.moveTo(x, PT); ctx.lineTo(x, PT + ph); ctx.stroke();
    }
    for (let v = mn; v <= mx + 0.5; v += 0.5) {
      const y = ty(v); if (y < PT - 1) break;
      ctx.beginPath(); ctx.moveTo(PL, y); ctx.lineTo(PL + pw, y); ctx.stroke();
    }

    // AF highlights
    if (showAnnot) {
      segments.forEach(seg => {
        const ss = Math.max(seg.startIdx - vStart, 0);
        const se = Math.min(seg.endIdx - vStart, sl.length);
        if (ss >= sl.length || se <= 0) return;
        ctx.fillStyle = dark ? "rgba(230,160,30,.18)" : "rgba(200,120,0,.12)";
        ctx.fillRect(tx(ss), PT, tx(se) - tx(ss), ph);
        ctx.strokeStyle = dark ? "rgba(230,160,30,.5)" : "rgba(180,100,0,.45)";
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(tx(ss), PT); ctx.lineTo(tx(ss), PT + ph); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(tx(se), PT); ctx.lineTo(tx(se), PT + ph); ctx.stroke();
        ctx.fillStyle = dark ? "rgba(230,160,30,.8)" : "rgba(150,80,0,.75)";
        ctx.font = "11px sans-serif";
        ctx.fillText("AF", tx(ss) + 4, PT + 14);
      });
    }

    // signal
    ctx.strokeStyle = dark ? "#5eead4" : "#0f766e";
    ctx.lineWidth = 1.3;
    ctx.lineJoin = "round";
    ctx.beginPath();
    sl.forEach((v, i) => i === 0 ? ctx.moveTo(tx(i), ty(v)) : ctx.lineTo(tx(i), ty(v)));
    ctx.stroke();

    // y-axis labels
    ctx.fillStyle = dark ? "rgba(180,180,180,.45)" : "rgba(100,100,100,.5)";
    ctx.font = "10px sans-serif";
    ctx.textAlign = "right";
    for (let v = 0; v <= 1; v += 0.5) ctx.fillText(v.toFixed(1), PL - 4, ty(v) + 3);
  }, [signal, segments, vStart, vWin, showAnnot, sampleRate, total]);

  useEffect(() => {
    draw();
    const mq = matchMedia("(prefers-color-scheme:dark)");
    mq.addEventListener("change", draw);
    const ro = new ResizeObserver(draw);
    if (canvasRef.current) ro.observe(canvasRef.current);
    return () => { mq.removeEventListener("change", draw); ro.disconnect(); };
  }, [draw]);

  const zoom = (f: number) => {
    const nw = Math.max(400, Math.min(total, Math.round(vWin * f)));
    setVStart(s => Math.max(0, Math.min(total - nw, s + Math.round((vWin - nw) / 2))));
    setVWin(nw);
  };

  const vEnd = Math.min(vStart + vWin, total);

  return (
    <div className="border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden bg-white dark:bg-gray-950">

      {/* header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 dark:border-gray-800">
        <span className="text-sm font-medium text-gray-800 dark:text-gray-100">ECG — {patientId}</span>
        <div className="flex gap-1.5">
          <button
            onClick={() => zoom(1.4)}
            className="px-2 py-1 text-xs border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
          >−</button>
          <button
            onClick={() => zoom(0.7)}
            className="px-2 py-1 text-xs border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
          >+</button>
          <button
            onClick={() => setShowAnnot(a => !a)}
            className={`px-2 py-1 text-xs rounded border transition-colors ${showAnnot
              ? "bg-amber-50 dark:bg-amber-950 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300"
              : "border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-500 bg-white dark:bg-gray-900"
              }`}
          >AF overlay</button>
        </div>
      </div>

      {/* canvas */}
      <canvas
        ref={canvasRef}
        className="block w-full select-none cursor-grab active:cursor-grabbing"
        style={{ height: 220 }}
        onWheel={e => { e.preventDefault(); zoom(e.deltaY > 0 ? 1.2 : 0.83); }}
        onMouseDown={e => { drag.current = { x: e.clientX, v: vStart }; }}
        onMouseMove={e => {
          if (!drag.current || !canvasRef.current) return;
          const r = canvasRef.current.getBoundingClientRect();
          const d = -Math.round(((e.clientX - drag.current.x) / r.width) * vWin);
          setVStart(Math.max(0, Math.min(total - vWin, drag.current.v + d)));
        }}
        onMouseUp={() => { drag.current = null; }}
        onMouseLeave={() => { drag.current = null; }}
        role="img"
        aria-label={`ECG waveform for ${patientId}. AF burden ${Math.round(afBurden * 100)}%.`}
      />

      {/* scrubber */}
      <div className="px-3 py-2 border-t border-gray-100 dark:border-gray-800">
        <input
          type="range"
          min={0}
          max={Math.max(0, total - vWin)}
          step={1}
          value={vStart}
          onChange={e => setVStart(+e.target.value)}
          className="w-full accent-teal-600"
          aria-label="Scroll position"
        />
      </div>

      {/* footer */}
      <div className="flex gap-4 px-3 py-2 border-t border-gray-100 dark:border-gray-800 text-xs text-gray-400 dark:text-gray-500">
        <span>
          AF burden:{" "}
          <span className="text-amber-600 dark:text-amber-400 font-medium">
            {Math.round(afBurden * 100)}%
          </span>
        </span>
        <span>{segments.length} segments flagged</span>
        <span className="ml-auto tabular-nums">
          {(vStart / sampleRate).toFixed(1)} – {(vEnd / sampleRate).toFixed(1)} s
        </span>
      </div>
    </div>
  );
}
