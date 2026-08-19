import { useBouncerInspect } from '@/hooks/useBouncers';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import LoadingSkeleton from '@/components/LoadingSkeleton';
import ErrorPanel from '@/components/ErrorPanel';

interface BouncerInspectDialogProps {
  name: string | null;
  onClose: () => void;
}

export default function BouncerInspectDialog({ name, onClose }: BouncerInspectDialogProps) {
  const { data, isLoading, error, refetch } = useBouncerInspect(name);

  const raw = data as Record<string, unknown> | undefined;
  const resolvedIp = (data?.ip_address ?? (raw as unknown as Record<string, unknown>)?.ipAddress ?? null) as string | null;
  const revoked = data?.revoked as boolean | undefined;
  const autoCreated = data?.auto_created as boolean | undefined;

  return (
    <Dialog open={name !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[82vh] w-[calc(100%-32px)] max-w-3xl overflow-hidden p-0 sm:w-full">
        <DialogHeader>
          <DialogTitle className="mono pr-8 text-sm">Bouncer {name ?? '—'}</DialogTitle>
          <DialogDescription>Bouncer registration, version, and last pull activity.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col min-h-0 overflow-hidden px-5 py-4">
          {isLoading && <LoadingSkeleton rows={4} />}
          {error && <ErrorPanel error={error} onRetry={() => refetch()} />}
          {data && (
            <div className="space-y-5 flex flex-col min-h-0 overflow-hidden">
              <div className="grid grid-cols-1 gap-3 rounded border border-[#232334] bg-[#0f0f17] p-3 text-sm sm:grid-cols-2">
                <div className="min-w-0">
                  <span className="mono text-xs uppercase tracking-widest text-zinc-500">Name</span>
                  <div className="mono mt-1 break-all text-zinc-200">{data.name ?? '—'}</div>
                </div>
                <div className="min-w-0">
                  <span className="mono text-xs uppercase tracking-widest text-zinc-500">Type</span>
                  <div className="mono mt-1 break-words text-xs text-zinc-300">{(data.type as string) ?? '—'}</div>
                </div>
                <div className="min-w-0">
                  <span className="mono text-xs uppercase tracking-widest text-zinc-500">Version</span>
                  <div className="mono mt-1 break-words text-xs text-zinc-300">{(data.version as string) ?? '—'}</div>
                </div>
                <div className="min-w-0">
                  <span className="mono text-xs uppercase tracking-widest text-zinc-500">IP Address</span>
                  <div className="mono tabular mt-1 break-all text-zinc-200">{resolvedIp ?? '—'}</div>
                </div>
                <div className="min-w-0">
                  <span className="mono text-xs uppercase tracking-widest text-zinc-500">OS</span>
                  <div className="mono mt-1 break-words text-zinc-300">{(data.os as string) ?? '—'}</div>
                </div>
                <div className="min-w-0">
                  <span className="mono text-xs uppercase tracking-widest text-zinc-500">Auth Type</span>
                  <div className="mono mt-1 break-words text-zinc-300">{(data.auth_type as string) ?? '—'}</div>
                </div>
                <div>
                  <span className="mono text-xs uppercase tracking-widest text-zinc-500">Revoked</span>
                  <div className="mt-1">
                    {typeof revoked === 'boolean' ? (
                      <Badge variant={revoked ? 'muted' : 'outline'}>{revoked ? 'revoked' : 'active'}</Badge>
                    ) : (
                      <span className="text-zinc-600">—</span>
                    )}
                  </div>
                </div>
                <div>
                  <span className="mono text-xs uppercase tracking-widest text-zinc-500">Auto Created</span>
                  <div className="mt-1">
                    {typeof autoCreated === 'boolean' ? (
                      <Badge variant={autoCreated ? 'muted' : 'outline'}>{autoCreated ? 'yes' : 'no'}</Badge>
                    ) : (
                      <span className="text-zinc-600">—</span>
                    )}
                  </div>
                </div>
                <div className="min-w-0">
                  <span className="mono text-xs uppercase tracking-widest text-zinc-500">Created At</span>
                  <div className="mono tabular mt-1 break-words text-xs text-zinc-400">{(data.created_at as string) ?? '—'}</div>
                </div>
                <div className="min-w-0">
                  <span className="mono text-xs uppercase tracking-widest text-zinc-500">Updated At</span>
                  <div className="mono tabular mt-1 break-words text-xs text-zinc-400">{(data.updated_at as string) ?? '—'}</div>
                </div>
                <div className="min-w-0">
                  <span className="mono text-xs uppercase tracking-widest text-zinc-500">Last Pull</span>
                  <div className="mono tabular mt-1 break-words text-xs text-zinc-400">{(data.last_pull as string) ?? '—'}</div>
                </div>
              </div>
              <p className="mono text-xs text-zinc-500">Last pull shows last LAPI poll time</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
