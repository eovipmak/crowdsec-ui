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
    { key: 'timestamp', header: 'Timestamp', className: 'mono text-xs tabular whitespace-nowrap' },
    { key: 'log_type', header: 'Log Type', className: 'mono text-xs' },
    { key: 'service', header: 'Service', className: 'mono text-xs' },
    { key: 'machine', header: 'Machine', className: 'mono text-xs' },
    { key: 'source_ip', header: 'Source IP', className: 'mono tabular' },
    { key: 'target_user', header: 'Target User', className: 'mono text-xs' },
    { key: 'datasource_path', header: 'Datasource', className: 'mono text-xs max-w-[180px] truncate' },
  ];

  return (
    <Dialog open={id !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[82vh] max-w-3xl overflow-hidden p-0">
        <DialogHeader>
          <DialogTitle className="mono text-sm">Alert #{id}</DialogTitle>
          <DialogDescription>Raw alert payload and derived decisions.</DialogDescription>
        </DialogHeader>

        <div className="max-h-[68vh] overflow-y-auto px-5 py-4">
          {isLoading && <LoadingSkeleton rows={4} />}
          {error && <ErrorPanel error={error} onRetry={() => refetch()} />}
          {data && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-3 rounded border border-[#232334] bg-[#0f0f17] p-3 text-sm">
                <div><span className="mono text-xs uppercase tracking-widest text-zinc-500">Scenario</span><div className="mt-1 text-zinc-200">{data.scenario}</div></div>
                <div><span className="mono text-xs uppercase tracking-widest text-zinc-500">Source IP</span><div className="mono mt-1 tabular text-zinc-200">{data.source_ip ?? '—'}</div></div>
                <div><span className="mono text-xs uppercase tracking-widest text-zinc-500">Country</span><div className="mt-1 text-zinc-300">{data.country ?? '—'}</div></div>
                <div><span className="mono text-xs uppercase tracking-widest text-zinc-500">AS</span><div className="mt-1 text-zinc-300">{data.as_name ?? '—'}</div></div>
                <div><span className="mono text-xs uppercase tracking-widest text-zinc-500">Events</span><div className="tabular mt-1 font-medium text-white">{data.events_count ?? 0}</div></div>
                <div><span className="mono text-xs uppercase tracking-widest text-zinc-500">Created</span><div className="mono mt-1 text-xs tabular text-zinc-400">{data.created_at ?? '—'}</div></div>
                <div className="col-span-2 border-t border-[#232334] pt-3"><span className="mono text-xs uppercase tracking-widest text-zinc-500">Message</span><div className="mt-1 text-sm leading-5 text-zinc-300">{data.message}</div></div>
              </div>

              {data.decisions && data.decisions.length > 0 && (
                <div>
                  <h4 className="mono mb-2 text-xs uppercase tracking-widest text-zinc-500">Decisions</h4>
                  <div className="flex flex-wrap gap-2">
                    {data.decisions.map((d: any, i: number) => (
                      <Badge key={i} variant="signal" className="mono">{d.type}: {d.duration}</Badge>
                    ))}
                  </div>
                </div>
              )}

              {data.events && data.events.length > 0 && (
                <div>
                  <h4 className="mono mb-2 text-xs uppercase tracking-widest text-zinc-500">Events — {data.events.length}</h4>
                  <DataTable data={data.events} columns={eventColumns} />
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
