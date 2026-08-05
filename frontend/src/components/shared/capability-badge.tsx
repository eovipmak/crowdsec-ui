import type { CapabilityState } from "@/lib/api/capabilities";

const LABELS: Record<CapabilityState, string> = {
  supported: "Supported",
  capability_gated: "Environment-dependent",
  unsupported: "Unsupported",
  unknown: "Unknown",
};

const CLASSES: Record<CapabilityState, string> = {
  supported: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  capability_gated: "bg-amber-50 text-amber-700 ring-amber-600/20",
  unsupported: "bg-slate-100 text-slate-500 ring-slate-500/20",
  unknown: "bg-slate-50 text-slate-400 ring-slate-400/20",
};

interface CapabilityBadgeProps {
  state: CapabilityState;
}

/**
 * Read-only support badge. `unsupported` rows must never render a functional
 * control (architecture §5.3); this badge is informational only.
 */
export function CapabilityBadge({ state }: CapabilityBadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${CLASSES[state]}`}
    >
      {LABELS[state]}
    </span>
  );
}
