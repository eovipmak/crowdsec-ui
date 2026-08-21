import { useAlert } from '@/hooks/useAlerts';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import LoadingSkeleton from '@/components/LoadingSkeleton';
import ErrorPanel from '@/components/ErrorPanel';

interface AlertInspectDialogProps {
  id: number | null;
  onClose: () => void;
}

type AlertEvent = {
  timestamp?: string;
  log_type?: string;
  service?: string;
  machine?: string;
  source_ip?: string;
  target_user?: string;
  datasource_path?: string;
};

export default function AlertInspectDialog({ id, onClose }: AlertInspectDialogProps) {
  const { data, isLoading, error, refetch } = useAlert(id);

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
                <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border border-[#232334] bg-[#12121a]">
                  <div className="flex shrink-0 items-center justify-between border-b border-[#232334] bg-[#0f0f17] px-3 py-2.5">
                    <h4 className="mono text-xs font-medium uppercase tracking-widest text-zinc-400">Events</h4>
                    <span className="mono rounded bg-[#232334] px-1.5 py-0.5 text-[11px] font-medium tabular text-zinc-300">{data.events.length}</span>
                  </div>
                  <div className="min-h-0 flex-1 overflow-y-auto [scrollbar-width:thin] [scrollbar-color:#3f3f5a_transparent]">
                    <ul className="divide-y divide-[#232334]/60">
                      {(data.events as AlertEvent[]).map((ev, idx) => (
                        <li key={idx} className="px-3 py-3 transition-colors hover:bg-[#181825]">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="mono text-xs tabular text-zinc-400">{ev.timestamp ?? '—'}</span>
                            <span className="h-1 w-1 shrink-0 rounded-full bg-zinc-600" aria-hidden />
                            {ev.log_type && (
                              <span className="mono inline-flex rounded bg-[#1c1c26] px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-wide text-zinc-300">{ev.log_type}</span>
                            )}
                            {ev.service && (
                              <span className="mono inline-flex rounded border border-[#232334] px-1.5 py-0.5 text-[11px] text-zinc-400">{ev.service}</span>
                            )}
                            <span className="mono ml-auto text-[11px] tabular text-zinc-600">#{idx + 1}</span>
                          </div>
                          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
                            <div className="min-w-0">
                              <div className="mono text-[10px] uppercase tracking-widest text-zinc-500">Source IP</div>
                              <div className="mono mt-1 break-all text-xs font-medium tabular text-zinc-200" title={ev.source_ip}>{ev.source_ip ?? '—'}</div>
                            </div>
                            <div className="min-w-0">
                              <div className="mono text-[10px] uppercase tracking-widest text-zinc-500">Target user</div>
                              <div className="mono mt-1 break-words text-xs text-zinc-300" title={ev.target_user}>{ev.target_user ?? '—'}</div>
                            </div>
                            <div className="min-w-0">
                              <div className="mono text-[10px] uppercase tracking-widest text-zinc-500">Machine</div>
                              <div className="mono mt-1 break-words text-xs text-zinc-300" title={ev.machine}>{ev.machine ?? '—'}</div>
                            </div>
                          </div>
                          <div className="mt-3 min-w-0 rounded bg-[#0f0f17] px-2.5 py-2">
                            <div className="mono text-[10px] uppercase tracking-widest text-zinc-500">Datasource</div>
                            <div className="mono mt-1 break-all text-xs leading-relaxed text-zinc-400" title={ev.datasource_path}>{ev.datasource_path ?? '—'}</div>
                          </div>
                        </li>
                      ))}
                    </ul>
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
