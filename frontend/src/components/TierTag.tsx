import type { BurdenTier } from "../types";
import { TIERS } from "../tiers";

// Tier swatch plus name; the burden figure is shown when known
export default function TierTag({ tier, burden }: { tier: BurdenTier; burden?: number | null }) {
    return (
        <span className="inline-flex items-center gap-1.5 text-sm">
            <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: TIERS[tier].color }} aria-hidden />
            <span>{TIERS[tier].name}</span>
            {burden != null && <span className="text-ink-soft">{Math.round(burden)}%</span>}
        </span>
    );
}
