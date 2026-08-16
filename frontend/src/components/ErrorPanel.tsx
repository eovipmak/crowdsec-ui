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
    <div className="rounded-md border border-red-900/30 bg-red-950/20 px-4 py-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-red-500" />
        <div className="flex-1">
          <p className="text-sm font-semibold tracking-tight text-red-200">Failed to load</p>
          <p className="mono mt-1 text-xs leading-5 text-red-200/70">
            {message}{code ? ` · Code: ${code}` : ''}
          </p>
          <p className="mono mt-2 text-xs text-zinc-500">Check cscli on the host, then retry.</p>
        </div>
        <Button variant="outline" size="sm" onClick={onRetry} className="shrink-0 border-red-900/40 text-red-200 hover:bg-red-950/40">
          Retry
        </Button>
      </div>
    </div>
  );
}
