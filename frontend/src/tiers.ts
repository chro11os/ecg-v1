import type { BurdenTier } from "./types";

export const TIERS: Record<BurdenTier, { name: string; detail: string; range: string; color: string }> = {
    0: { name: "Sinus rhythm", detail: "No AFib found", range: "0%", color: "var(--color-tier-0)" },
    1: { name: "Micro-burden", detail: "Rare paroxysm", range: "under 5%", color: "var(--color-tier-1)" },
    2: { name: "Intermediate burden", detail: "Active paroxysm", range: "5–50%", color: "var(--color-tier-2)" },
    3: { name: "High burden", detail: "Persistent AFib", range: "50% or more", color: "var(--color-tier-3)" },
};

// Mirrors model.THRESHOLD. Uploads are at most 5 windows, which the backend only thresholds (no smoothing).
export const AF_THRESHOLD = 0.6;

export function parseJson<T>(value: unknown, fallback: T): T {
    if (typeof value !== "string") return (value as T) ?? fallback;
    try {
        return JSON.parse(value) as T;
    } catch {
        return fallback;
    }
}
