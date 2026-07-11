import type { BurdenTier } from "../types";

interface HistoryItem {
    id: string;
    fileName: string;
    timestamp: string;
    burdenTier: BurdenTier;
    confidence: number;
    burden: number;
    hardware: string;
    responseTime: number;
    rawSignal: number[];
    rPeaks?: number[];
    rrVariance?: number;
    rmssd?: number;
    gradCam?: number[];
    strokeRiskScore?: number;
    cumulativeAFibBurden?: number;
    patientId?: string;
}

interface ScanHistoryProps {
    history: HistoryItem[];
    scanFilter: string;
    setScanFilter: (f: string) => void;
    scanSort: string;
    setScanSort: (s: string) => void;
    loadHistoryItem: (item: HistoryItem) => void;
}

export default function ScanHistory({
    history,
    scanFilter,
    setScanFilter,
    scanSort,
    setScanSort,
    loadHistoryItem,
}: ScanHistoryProps) {
    return (
        <div className="space-y-3">
            {/* Filter and Sort Toolbar */}
            <div className="grid grid-cols-2 gap-2 pb-3 border-b border-border-subtle mb-2">
                <div>
                    <label className="block text-[8px] font-mono text-brand-secondary uppercase mb-0.5">Filter Type</label>
                    <select
                        value={scanFilter}
                        onChange={e => setScanFilter(e.target.value)}
                        className="w-full bg-bg-canvas border border-border-subtle text-[9px] p-1 rounded-none font-mono text-text-primary cursor-pointer font-bold"
                    >
                        <option value="ALL">ALL TYPES</option>
                        <option value="0">SINUS RHYTHM</option>
                        <option value="1">MICRO-BURDEN</option>
                        <option value="2">INTERMEDIATE</option>
                        <option value="3">HIGH BURDEN</option>
                    </select>
                </div>
                <div>
                    <label className="block text-[8px] font-mono text-brand-secondary uppercase mb-0.5">Arrange By</label>
                    <select
                        value={scanSort}
                        onChange={e => setScanSort(e.target.value)}
                        className="w-full bg-bg-canvas border border-border-subtle text-[9px] p-1 rounded-none font-mono text-text-primary cursor-pointer font-bold"
                    >
                        <option value="NEWEST">NEWEST FIRST</option>
                        <option value="OLDEST">OLDEST FIRST</option>
                        <option value="TYPE_ASC">TYPE (LOW→HIGH)</option>
                        <option value="TYPE_DESC">TYPE (HIGH→LOW)</option>
                    </select>
                </div>
            </div>

            {(() => {
                // 1. Filter
                let filtered = [...history];
                if (scanFilter !== "ALL") {
                    const tierNum = Number(scanFilter);
                    filtered = filtered.filter(item => item.burdenTier === tierNum);
                }

                // 2. Sort/Arrange
                filtered.sort((a, b) => {
                    if (scanSort === "NEWEST") {
                        return b.timestamp.localeCompare(a.timestamp);
                    }
                    if (scanSort === "OLDEST") {
                        return a.timestamp.localeCompare(b.timestamp);
                    }
                    if (scanSort === "TYPE_ASC") {
                        return a.burdenTier - b.burdenTier;
                    }
                    if (scanSort === "TYPE_DESC") {
                        return b.burdenTier - a.burdenTier;
                    }
                    return 0;
                });

                if (filtered.length === 0) {
                    return (
                        <p className="text-xs font-mono text-brand-secondary text-center py-10">
                            NO MATCHING SCANS
                        </p>
                    );
                }

                return filtered.map((item) => (
                    <div
                        key={item.id}
                        onClick={() => loadHistoryItem(item)}
                        className="p-4 rounded-none bg-bg-canvas border border-border-subtle hover:border-brand-primary hover:bg-card-bg cursor-pointer transition-all duration-200 active:scale-[0.99] shadow-xs hover:shadow-md"
                    >
                        <div className="flex justify-between items-start gap-2 mb-2">
                            <span className="text-xs font-mono font-bold truncate max-w-40 text-text-primary">
                                {item.fileName}
                            </span>
                            <span className="text-[9px] font-mono text-brand-secondary-muted shrink-0 mt-0.5">
                                {item.timestamp}
                            </span>
                        </div>

                        <div className="flex justify-between items-center mt-3">
                            <span className={`px-2 py-0.5 text-[9px] font-mono font-bold rounded-none uppercase tracking-wider ${
                                item.burdenTier === 0 ? 'bg-status-healthy-light text-status-healthy border border-status-healthy-light-border' :
                                item.burdenTier === 1 ? 'bg-status-info-light text-status-info border border-status-info-light-border' :
                                item.burdenTier === 2 ? 'bg-status-warning-light text-status-warning border border-status-warning-light-border' :
                                'bg-status-critical-light text-status-critical border border-status-critical-light-border'
                            }`}>
                                {item.burdenTier === 0 ? 'Sinus Rhythm' :
                                 item.burdenTier === 1 ? 'Micro' :
                                 item.burdenTier === 2 ? 'Intermed.' : 'High'}
                            </span>
                            <span className="text-[9px] font-mono text-brand-secondary shrink-0">
                                {item.responseTime}MS ON {item.hardware.toUpperCase()}
                            </span>
                        </div>
                    </div>
                ));
            })()}
        </div>
    );
}
export type { HistoryItem };
