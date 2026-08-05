"use client";

/**
 * useMutation — shared mutation workflow (architecture §4.7).
 *
 * Two-step flow:
 *  1. issueConfirmation() posts to POST /api/v1/confirmations with the typed
 *     operation + request; the server validates and returns an opaque token
 *     bound to the operation, the canonical request, and the session.
 *  2. execute() calls the mutation endpoint with `confirmation: token`; the
 *     server re-verifies the binding before running the cscli command.
 *
 * The token is opaque to the frontend — there is no client-computable
 * confirmation, and no command text ever leaves the typed request.
 */
import { useCallback, useState } from "react";
import type { ApiError } from "@/lib/api/errors";
import { isApiError } from "@/lib/api/errors";
import type {
  ConfirmationIssuanceRequest,
  ConfirmationIssuanceResponse,
  MutationEnvelope,
  MutationOperationId,
} from "@/lib/api/types";

export interface MutationOutcome {
  ok: boolean;
  error?: ApiError;
}

export interface MutationState {
  /** True while confirmation is being issued or the mutation runs. */
  isPending: boolean;
  /** Latest issued confirmation, or null before/after completion. */
  confirmation: ConfirmationIssuanceResponse["confirmation"] | null;
  /** Latest outcome of the mutation step (null before it runs). */
  outcome: MutationOutcome | null;
  /** Result envelope of a successful mutation (null otherwise). */
  result: MutationEnvelope<MutationOperationId> | null;
}

export function useMutation() {
  const [state, setState] = useState<MutationState>({
    isPending: false,
    confirmation: null,
    outcome: null,
    result: null,
  });

  const reset = useCallback(() => {
    setState({ isPending: false, confirmation: null, outcome: null, result: null });
  }, []);

  const issueConfirmation = useCallback(
    async (issue: () => Promise<ConfirmationIssuanceResponse>): Promise<ConfirmationIssuanceResponse["confirmation"] | null> => {
      setState((prev) => ({ ...prev, isPending: true, outcome: null, confirmation: null }));
      try {
        const response = await issue();
        setState((prev) => ({ ...prev, isPending: false, confirmation: response.confirmation }));
        return response.confirmation;
      } catch (err) {
        setState((prev) => ({
          ...prev,
          isPending: false,
          confirmation: null,
          outcome: { ok: false, error: toApiError(err) },
        }));
        return null;
      }
    },
    [],
  );

  const execute = useCallback(
    async (run: (token: string) => Promise<MutationEnvelope<MutationOperationId>>): Promise<boolean> => {
      setState((prev) => ({ ...prev, isPending: true, outcome: null }));
      const token = state.confirmation?.token;
      if (!token) {
        setState((prev) => ({
          ...prev,
          isPending: false,
          outcome: { ok: false, error: new ApiError("confirmation_required", "This action requires confirmation.") },
        }));
        return false;
      }
      try {
        const result = await run(token);
        setState((prev) => ({ ...prev, isPending: false, confirmation: null, outcome: { ok: true }, result }));
        return true;
      } catch (err) {
        setState((prev) => ({
          ...prev,
          isPending: false,
          confirmation: null,
          outcome: { ok: false, error: toApiError(err) },
        }));
        return false;
      }
    },
    [state.confirmation],
  );

  return { ...state, issueConfirmation, execute, reset };
}

function toApiError(err: unknown): ApiError {
  if (isApiError(err)) {
    return err;
  }
  return new ApiError("internal", "An unexpected error occurred.");
}

export type { ConfirmationIssuanceRequest };
