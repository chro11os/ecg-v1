import type { DiagnosisData } from "../types";
import TierTag from "./TierTag";

type HistoryItem = Omit<DiagnosisData, "id"> & { id: string; fileName: string; timestamp: string };

interface ScanHistoryProps {
    history: HistoryItem[];
    emptyText: string;
    scanFilter: string;
    setScanFilter: (f: string) => void;
    scanSort: string;
    setScanSort: (s: string) => void;
    loadHistoryItem: (item: HistoryItem) => void;
}

export default function ScanHistory({ history, emptyText, scanFilter, setScanFilter, scanSort, setScanSort, loadHistoryItem }: ScanHistoryProps) {
    const shown = history
        .filter(item => scanFilter === "ALL" || item.burdenTier === Number(scanFilter))
        .sort((a, b) => {
            if (scanSort === "OLDEST") return a.timestamp.localeCompare(b.timestamp);
            if (scanSort === "TYPE_ASC") return (a.burden ?? -1) - (b.burden ?? -1);
            if (scanSort === "TYPE_DESC") return (b.burden ?? -1) - (a.burden ?? -1);
            return b.timestamp.localeCompare(a.timestamp);
        });

    return (
        <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
                <label className="text-sm text-ink-soft">
                    Show
                    <select value={scanFilter} onChange={e => setScanFilter(e.target.value)} className="mt-1 w-full rounded-md border border-line bg-sheet px-2 py-1 text-sm text-ink">
                        <option value="ALL">All tiers</option>
                        <option value="0">Sinus rhythm</option>
                        <option value="1">Micro-burden</option>
                        <option value="2">Intermediate</option>
                        <option value="3">High burden</option>
                    </select>
                </label>
                <label className="text-sm text-ink-soft">
                    Sort by
                    <select value={scanSort} onChange={e => setScanSort(e.target.value)} className="mt-1 w-full rounded-md border border-line bg-sheet px-2 py-1 text-sm text-ink">
                        <option value="NEWEST">Newest first</option>
                        <option value="OLDEST">Oldest first</option>
                        <option value="TYPE_DESC">Highest burden</option>
                        <option value="TYPE_ASC">Lowest burden</option>
                    </select>
                </label>
            </div>

            {shown.length === 0 ? (
                <p className="py-8 text-center text-sm text-ink-soft">{history.length ? "No scans in that tier." : emptyText}</p>
            ) : (
                <ul className="-mx-2 space-y-0.5">
                    {shown.map(item => (
                        <li key={item.id}>
                            <button onClick={() => loadHistoryItem(item)} className="w-full rounded-lg px-2 py-2 text-left hover:bg-hover">
                                <span className="flex justify-between gap-2 text-sm">
                                    <span className="truncate font-medium">{item.fileName}</span>
                                    <span className="shrink-0 text-ink-soft">{item.timestamp}</span>
                                </span>
                                <TierTag tier={item.burdenTier} burden={item.burden} />
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
export type { HistoryItem };
