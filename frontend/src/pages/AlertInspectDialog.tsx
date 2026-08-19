import { useAlert } from '@/hooks/useAlerts';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import DataTable, { type Column } from '@/components/DataTable';
import LoadingSkeleton from '@/components/LoadingSkeleton';
import ErrorPanel from '@/components/ErrorPanel';

interface AlertInspectDialogProps {
  id: number | null;
  onClose: () => void;
}

export default function AlertInspectDialog({ id, onClose }: AlertInspectDialogProps) {
  const { data, isLoading, error, refetch } = useAlert(id);

  const eventColumns: Column<any>[] = [
    { key: 'timestamp', header: 'Timestamp', className: 'mono text-xs tabular whitespace-normal break-words' },
    { key: 'log_type', header: 'Log Type', className: 'mono text-xs break-words' },
    { key: 'service', header: 'Service', className: 'mono text-xs break-words' },
    { key: 'machine', header: 'Machine', className: 'mono text-xs break-words' },
    { key: 'source_ip', header: 'Source IP', className: 'mono tabular break-all' },
    { key: 'target_user', header: 'Target User', className: 'mono text-xs break-words' },
    { key: 'datasource_path', header: 'Datasource', className: 'mono text-xs break-all' },
  ];

  return (
    <Dialog open={id !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[82vh] w-[calc(100%-32px)] max-w-3xl overflow-hidden p-0 sm:w-full">
        <DialogHeader>
          <DialogTitle className="mono pr-8 text-sm">Alert #{id}</DialogTitle>
          <DialogDescription>Raw alert payload and derived decisions.</DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-5 py-4">
          {isLoading && <LoadingSkeleton rows={4} />}
          {error && <ErrorPanel error={error} onRetry={() => refetch()} />}
          {data && (
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden space-y-5">
              <div className="grid shrink-0 grid-cols-1 gap-3 rounded border border-[#232334] bg-[#0f0f17] p-3 text-sm sm:grid-cols-2">
                <div className="min-w-0"><span className="mono text-xs uppercase tracking-widest text-zinc-500">Scenario</span><div className="mt-1 break-words text-zinc-200">{data.scenario}</div></div>
                <div className="min-w-0"><span className="mono text-xs uppercase tracking-widest text-zinc-500">Source IP</span><div className="mono mt-1 break-all tabular text-zinc-200">{data.source_ip ?? '—'}</div></div>
                <div><span className="mono text-xs uppercase tracking-widest text-zinc-500">Country</span><div className="mt-1 text-zinc-300">{data.country ?? '—'}</div></div>
                <div className="min-w-0"><span className="mono text-xs uppercase tracking-widest text-zinc-500">AS</span><div className="mt-1 break-words text-zinc-300">{data.as_name ?? '—'}</div></div>
                <div><span className="mono text-xs uppercase tracking-widest text-zinc-500">Events</span><div className="tabular mt-1 font-medium text-white">{data.events_count ?? 0}</div></div>
                <div className="min-w-0"><span className="mono text-xs uppercase tracking-widest text-zinc-500">Created</span><div className="mono mt-1 break-words text-xs tabular text-zinc-400">{data.created_at ?? '—'}</div></div>
                <div className="col-span-1 border-t border-[#232334] pt-3 sm:col-span-2"><span className="mono text-xs uppercase tracking-widest text-zinc-500">Message</span><div className="mt-1 break-words text-sm leading-5 text-zinc-300">{data.message}</div></div>
              </div>

              {data.decisions && data.decisions.length > 0 && (
                <div className="shrink-0">
                  <h4 className="mono mb-2 text-xs uppercase tracking-widest text-zinc-500">Decisions</h4>
                  <div className="flex flex-wrap gap-2">
                    {data.decisions.map((d: any, i: number) => (
                      <Badge key={i} variant="signal" className="mono">{d.type}: {d.duration}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {data.events && data.events.length > 0 && (
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-md">
                  <h4 className="mono mb-2 shrink-0 text-xs uppercase tracking-widest text-zinc-500">Events — {data.events.length}</h4>
                  <div className="min-h-0 flex-1 overflow-y-auto">
                    <DataTable data={data.events} columns={eventColumns} noHorizontalScroll />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
