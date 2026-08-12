/**
 * Capability utilities (architecture §5.2).
 *
 * GET /api/v1/capabilities reports per-operation support from the startup
 * probe cache. The UI uses these values to distinguish supported,
 * capability-gated (environment-dependent), and explicitly unsupported
 * operations — and must never create a functional control for an
 * "unsupported" row.
 */
import type { CapabilitiesResponse, OperationId } from "@/lib/api/types";

export type CapabilityState = "supported" | "capability_gated" | "unsupported" | "unknown";

export function capabilityFor(
  caps: CapabilitiesResponse | null,
  operation: OperationId,
): CapabilityState {
  if (!caps || !caps.capabilities) {
    return "unknown";
  }
  return caps.capabilities[operation] ?? "unknown";
}

export function isCapabilitySupported(
  caps: CapabilitiesResponse | null,
  operation: OperationId,
): boolean {
  return capabilityFor(caps, operation) === "supported";
}
