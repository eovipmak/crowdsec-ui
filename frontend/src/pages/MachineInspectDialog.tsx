import { useMachineInspect } from '@/hooks/useMachines';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import DataTable, { type Column } from '@/components/DataTable';
import LoadingSkeleton from '@/components/LoadingSkeleton';
import ErrorPanel from '@/components/ErrorPanel';

interface MachineInspectDialogProps {
  machineId: string | null;
  onClose: () => void;
}

export default function MachineInspectDialog({ machineId, onClose }: MachineInspectDialogProps) {
  const { data, isLoading, error, refetch } = useMachineInspect(machineId);

  const resolvedMachineId = (data?.machineId ?? data?.machine_id ?? null) as string | null;
  const resolvedIp = (data?.ipAddress ?? data?.ip_address ?? null) as string | null;
  const rawValidated = data as Record<string, unknown> | undefined;
  const resolvedValidated: boolean | null =
    typeof rawValidated?.isValidated === 'boolean'
      ? (rawValidated.isValidated as boolean)
      : typeof rawValidated?.validated === 'boolean'
        ? (rawValidated.validated as boolean)
        : null;

  const hasDatasources = (() => {
    const ds = data?.datasources;
    if (ds == null) return false;
    if (Array.isArray(ds)) return ds.length > 0;
    if (typeof ds === 'object') return Object.keys(ds as object).length > 0;
    return Boolean(ds);
  })();

  return (
    <Dialog open={machineId !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-h-[82vh] w-[calc(100%-32px)] max-w-3xl overflow-hidden p-0 sm:w-full">
        <DialogHeader>
          <DialogTitle className="mono pr-8 text-sm">Machine {machineId ?? '—'}</DialogTitle>
          <DialogDescription>Registration, heartbeat, and datasource details.</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col min-h-0 overflow-hidden px-5 py-4">
          {isLoading && <LoadingSkeleton rows={4} />}
          {error && <ErrorPanel error={error} onRetry={() => refetch()} />}
          {data && (
            <div className="space-y-5 flex flex-col min-h-0 overflow-hidden">
              <div className="grid grid-cols-1 gap-3 rounded border border-[#232334] bg-[#0f0f17] p-3 text-sm sm:grid-cols-2">
                <div className="min-w-0">
                  <span className="mono text-xs uppercase tracking-widest text-zinc-500">Machine ID</span>
                  <div className="mono mt-1 break-all text-zinc-200">{resolvedMachineId ?? '—'}</div>
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
                  <span className="mono text-xs uppercase tracking-widest text-zinc-500">Version</span>
                  <div className="mono mt-1 break-words text-xs text-zinc-300">{(data.version as string) ?? '—'}</div>
                </div>
                <div className="min-w-0">
                  <span className="mono text-xs uppercase tracking-widest text-zinc-500">Auth Type</span>
                  <div className="mono mt-1 break-words text-zinc-300">{(data.auth_type as string) ?? '—'}</div>
                </div>
                <div>
                  <span className="mono text-xs uppercase tracking-widest text-zinc-500">Validated</span>
                  <div className="mt-1">
                    {resolvedValidated == null ? (
                      <span className="text-zinc-600">—</span>
                    ) : resolvedValidated ? (
                      <Badge variant="success">validated</Badge>
                    ) : (
                      <Badge variant="muted">pending</Badge>
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
                  <span className="mono text-xs uppercase tracking-widest text-zinc-500">Last Heartbeat</span>
                  <div className="mono tabular mt-1 break-words text-xs text-zinc-400">{(data.last_heartbeat as string) ?? '—'}</div>
                </div>
                <div className="min-w-0">
                  <span className="mono text-xs uppercase tracking-widest text-zinc-500">Last Push</span>
                  <div className="mono tabular mt-1 break-words text-xs text-zinc-400">{(data.last_push as string) ?? '—'}</div>
                </div>
              </div>

              <div>
                <h4 className="mono mb-2 text-xs uppercase tracking-widest text-zinc-500">Datasources</h4>
                {!hasDatasources ? (
                  <p className="mono rounded border border-[#232334] bg-[#0f0f17] px-3 py-3 text-xs text-zinc-500">
                    No datasource details returned by this LAPI
                  </p>
                ) : (
                  <DatasourceRenderer datasources={data.datasources} />
                )}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DatasourceRenderer({ datasources }: { datasources: unknown }) {
  if (datasources == null) return null;

  if (Array.isArray(datasources)) {
    if (datasources.length === 0) return null;
    const first = datasources[0];
    // Primitive array (strings)
    if (typeof first === 'string' || typeof first === 'number') {
      return (
        <div className="rounded border border-[#232334] bg-[#0f0f17] p-3">
          <ul className="mono space-y-1 break-all text-xs text-zinc-300">
            {(datasources as unknown[]).map((v, i) => (
              <li key={i}>{String(v)}</li>
            ))}
          </ul>
        </div>
      );
    }
    // Array of objects — render DataTable with inferred columns
    if (typeof first === 'object' && first !== null) {
      const keys = Object.keys(first as object);
      const columns: Column<Record<string, unknown>>[] = keys.map((k) => ({
        key: k,
        header: k,
        className: 'mono break-words text-xs',
      }));
      return (
        <div className="overflow-x-hidden rounded-md">
          <DataTable data={datasources as Record<string, unknown>[]} columns={columns} noHorizontalScroll />
        </div>
      );
    }
    return (
      <div className="rounded border border-[#232334] bg-[#0f0f17] p-3">
        <pre className="mono break-all text-xs text-zinc-300">{JSON.stringify(datasources, null, 2)}</pre>
      </div>
    );
  }

  if (typeof datasources === 'object') {
    const entries = Object.entries(datasources as Record<string, unknown>);
    if (entries.length === 0) return null;
    // If values are primitives, render key-value list; if objects, try DataTable
    const allPrimitive = entries.every(([, v]) => v == null || typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean');
    if (allPrimitive) {
      return (
        <div className="rounded border border-[#232334] bg-[#0f0f17] p-3">
          <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {entries.map(([k, v]) => (
              <div key={k} className="min-w-0">
                <dt className="mono text-xs uppercase tracking-widest text-zinc-500">{k}</dt>
                <dd className="mono mt-1 break-all text-xs text-zinc-300">{v == null || v === '' ? '—' : String(v)}</dd>
              </div>
            ))}
          </dl>
        </div>
      );
    }
    const columns: Column<Record<string, unknown>>[] = [
      { key: 'source', header: 'Source', className: 'mono break-all text-xs' },
      { key: 'details', header: 'Details', className: 'mono break-words text-xs' },
    ];
    const rows = entries.map(([k, v]) => ({
      source: k,
      details: typeof v === 'string' ? v : JSON.stringify(v),
    }));
    return (
      <div className="overflow-x-hidden rounded-md">
        <DataTable data={rows} columns={columns} noHorizontalScroll />
      </div>
    );
  }

  return (
    <div className="rounded border border-[#232334] bg-[#0f0f17] p-3">
      <pre className="mono break-all text-xs text-zinc-300">{String(datasources)}</pre>
    </div>
  );
}
