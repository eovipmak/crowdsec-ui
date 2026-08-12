/**
 * Adapter between the shared `useMutation` outcome (which carries `ApiError`)
 * and the shared `OperationStatus` component (which expects `OperationError`).
 *
 * The shared components are owned by task 07 and must not be modified, so the
 * conversion happens here. Only the safe, renderable fields are copied — never
 * secrets, tokens, or raw command output.
 */
import type { MutationOutcome } from "@/lib/hooks/use-mutation";
import type { OperationError } from "@/lib/api/types";

export function toOperationStatusOutcome(
  outcome: MutationOutcome | null,
): { ok: boolean; error?: OperationError } | null {
  if (!outcome) {
    return null;
  }
  if (outcome.ok) {
    return { ok: true };
  }
  const err = outcome.error;
  return {
    ok: false,
    error: err
      ? {
          code: err.code as OperationError["code"],
          message: err.message,
          retryable: err.retryable,
        }
      : undefined,
  };
}
