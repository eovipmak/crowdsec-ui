import { isApiError } from "@/lib/api/errors";
import { Button } from "@/components/ui/button";

interface LoadingStateProps {
  label?: string;
}

/** Visible loading state with an accessible status announcement. */
export function LoadingState({ label = "Loading…" }: LoadingStateProps) {
  return (
    <div role="status" className="flex flex-col items-center justify-center gap-3 px-4 py-12 text-center">
      <span
        aria-hidden="true"
        className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-slate-900"
      />
      <span className="text-sm text-slate-600">{label}</span>
    </div>
  );
}

interface EmptyStateProps {
  title?: string;
  message?: string;
}

/** Empty (valid, not an error) collection state. */
export function EmptyState({
  title = "Nothing to show",
  message = "The current CrowdSec data returned no items for this view.",
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-md border border-dashed border-slate-300 bg-white px-4 py-10 text-center">
      <p className="text-sm font-medium text-slate-700">{title}</p>
      <p className="max-w-md text-sm text-slate-500">{message}</p>
    </div>
  );
}

interface ErrorStateProps {
  title?: string;
  error: unknown;
  onRetry?: () => void;
}

/**
 * Safe error rendering: shows the readable, secret-free message from the API
 * error contract plus a refresh control. Never renders raw command output or
 * stack traces (REQ-063).
 */
export function ErrorState({ title = "Something went wrong", error, onRetry }: ErrorStateProps) {
  const apiError = isApiError(error) ? error : null;
  const message =
    apiError?.message ?? "An unexpected error occurred. Check the dashboard logs for details.";

  return (
    <div
      role="alert"
      className="flex flex-col items-start gap-3 rounded-md border border-red-200 bg-red-50 px-4 py-4"
    >
      <div>
        <p className="text-sm font-semibold text-red-800">{title}</p>
        <p className="mt-1 text-sm text-red-700">{message}</p>
        {apiError ? (
          <p className="mt-1 font-mono text-xs text-red-600">
            Code: {apiError.code}
            {apiError.retryable ? " · retryable" : ""}
          </p>
        ) : null}
      </div>
      {onRetry ? (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Retry
        </Button>
      ) : null}
    </div>
  );
}

interface UnsupportedNoticeProps {
  operation: string;
  message?: string;
}

/**
 * Explicitly unsupported / capability-gated operation notice. No functional
 * control is rendered — the matrix forbids inventing one (architecture §5.3).
 */
export function UnsupportedNotice({
  operation,
  message = "This operation is not supported by the current CrowdSec installation and no control is available.",
}: UnsupportedNoticeProps) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
      <span aria-hidden="true" className="mt-0.5 text-amber-600">
        ⚠
      </span>
      <div>
        <p className="font-medium">Unsupported operation</p>
        <p className="mt-0.5 text-amber-700">{message}</p>
        <p className="mt-1 font-mono text-xs text-amber-600">{operation}</p>
      </div>
    </div>
  );
}
