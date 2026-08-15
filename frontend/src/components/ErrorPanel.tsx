import { ApiError } from '@/lib/api/client';
import { messageFor } from '@/lib/api/errors';
import { Button } from '@/components/ui/button';

type ErrorPanelProps = {
  error: ApiError | Error;
  onRetry: () => void;
};

/**
 * Readable operation-failure panel with a retry button (plan §7.1).
 * Falls back to the safe message table for unknown codes (plan §3.2).
 */
export default function ErrorPanel({ error, onRetry }: ErrorPanelProps) {
  const message =
    error instanceof ApiError ? messageFor(error.code) : 'An unexpected error occurred.';

  return (
    <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4">
      <p className="text-sm font-medium text-destructive">{message}</p>
      {error instanceof ApiError && error.code ? (
        <p className="mt-1 text-xs text-muted-foreground">Code: {error.code}</p>
      ) : null}
      <Button variant="outline" size="sm" className="mt-3" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}
