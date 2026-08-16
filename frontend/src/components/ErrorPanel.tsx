import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api/client';

interface ErrorPanelProps {
  error: Error | ApiError;
  onRetry: () => void;
}

export default function ErrorPanel({ error, onRetry }: ErrorPanelProps) {
  const code = error instanceof ApiError ? error.code : null;
  const message = error.message || 'An unexpected error occurred.';

  return (
    <div role="alert" aria-live="polite" className="rounded-md border border-red-900/30 bg-red-950/20 px-4 py-4">
      <div className="flex flex-wrap items-start gap-3">
        <div className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-red-500" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold tracking-tight text-red-200">Failed to load</p>
          <p className="mono mt-1 break-words text-xs leading-5 text-red-200/70">
            {message}{code ? ` · Code: ${code}` : ''}
          </p>
          <p className="mono mt-2 text-xs text-zinc-500">Check cscli on the host, then retry. Nothing was lost.</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={onRetry}
          aria-label="Retry loading data"
          className="min-h-[32px] shrink-0 border-red-900/40 text-red-200 hover:bg-red-950/40"
        >
          Retry
        </Button>
      </div>
    </div>
  );
}
