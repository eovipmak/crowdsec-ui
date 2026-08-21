import { useEffect, useState } from 'react';
import { useMetrics, type MetricsPayload } from '@/hooks/useMetrics';
import { METRICS_SHOW } from '@/lib/api/types';
import { useCapabilities } from '@/hooks/useCapabilities';
import LoadingSkeleton from '@/components/LoadingSkeleton';
import ErrorPanel from '@/components/ErrorPanel';
import CapabilityBadge from '@/components/CapabilityBadge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

const METRICS_COMPONENTS = [
  'acquisition',
  'alerts',
  'appsec-engine',
  'appsec-rule',
  'bouncers',
  'decisions',
  'lapi',
  'lapi-bouncer',
  'lapi-decisions',
  'lapi-machine',
  'parsers',
  'scenarios',
  'stash',
  'whitelists',
] as const;

function isEmptyObject(v: unknown): boolean {
  return !!v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v as Record<string, unknown>).length === 0;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

function formatCount(n: number): string {
  return new Intl.NumberFormat('en-US').format(n);
}

function Scalar({ value }: { value: string | number | boolean }) {
  const str = typeof value === 'number' ? formatCount(value) : String(value);
  const isNum = typeof value === 'number';
  return <span className={isNum ? 'mono tabular font-medium text-zinc-200' : 'mono break-all text-zinc-300'}>{str}</span>;
}

function InlineValue({ value }: { value: unknown }) {
  if (value == null) return <span className="text-zinc-600">—</span>;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return <Scalar value={value} />;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="text-zinc-600">—</span>;
    const allPrimitive = value.every((v) => v == null || typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean');
    if (allPrimitive) {
      return (
        <span className="flex flex-wrap gap-1.5">
          {value.map((v, i) => (
            <span key={i} className="mono inline-flex rounded bg-[#1c1c26] px-1.5 py-0.5 text-xs text-zinc-300">
              {v == null ? '—' : String(v)}
            </span>
          ))}
        </span>
      );
    }
    return (
      <span className="flex flex-col gap-1.5">
        {value.map((v, i) => (
          <span key={i} className="flex flex-wrap gap-x-2 gap-y-1 rounded bg-[#0f0f17] px-2 py-1 text-xs">
            {isRecord(v) ? (
              Object.entries(v).map(([k, sv]) => (
                <span key={k} className="inline-flex gap-1">
                  <span className="mono text-[11px] text-zinc-500">{k}:</span>
                  <span className="mono text-xs text-zinc-300">{sv == null ? '—' : typeof sv === 'object' ? String((sv as unknown) ?? '') : String(sv)}</span>
                </span>
              ))
            ) : (
              <span className="mono text-xs text-zinc-300">{String(v)}</span>
            )}
          </span>
        ))}
      </span>
    );
  }
  if (isRecord(value)) {
    const entries = Object.entries(value);
    if (entries.length === 0) return <span className="text-zinc-600">—</span>;
    return (
      <span className="flex flex-wrap gap-x-3 gap-y-1">
        {entries.map(([k, sv]) => (
          <span key={k} className="inline-flex items-baseline gap-1">
            <span className="mono text-[11px] text-zinc-500">{k}:</span>
            {sv == null ? (
              <span className="mono text-xs text-zinc-600">—</span>
            ) : typeof sv === 'string' || typeof sv === 'number' || typeof sv === 'boolean' ? (
              <Scalar value={sv} />
            ) : Array.isArray(sv) ? (
              <span className="mono text-xs text-zinc-400">{sv.length} items</span>
            ) : isRecord(sv) ? (
              <span className="mono text-xs text-zinc-400">{Object.keys(sv).length} fields</span>
            ) : (
              <span className="mono text-xs text-zinc-400">—</span>
            )}
          </span>
        ))}
      </span>
    );
  }
  return <span className="mono text-xs text-zinc-400">—</span>;
}

function MetricMap({ data }: { data: Record<string, unknown> }) {
  const entries = Object.entries(data);
  if (entries.length === 0) {
    return <p className="mono py-6 text-center text-xs text-zinc-500">No data yet</p>;
  }

  const allPrimitive = entries.every(([, v]) => v == null || typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean');
  if (allPrimitive) {
    return (
      <div className="overflow-auto rounded border border-[#232334]">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-[#232334] bg-[#0f0f17]">
            <tr>
              <th className="mono px-3 py-2 text-[11px] font-medium uppercase tracking-widest text-zinc-500">Key</th>
              <th className="mono px-3 py-2 text-[11px] font-medium uppercase tracking-widest text-zinc-500">Value</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#181825] bg-[#12121a]">
            {entries.map(([k, v]) => (
              <tr key={k} className="hover:bg-[#181825]/50">
                <td className="mono max-w-[260px] break-all px-3 py-2 align-top font-medium text-zinc-300">{k}</td>
                <td className="px-3 py-2 align-top">
                  {v == null ? <span className="text-zinc-600">—</span> : <Scalar value={v as string | number | boolean} />}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  const objectEntries = entries.filter(([, v]) => isRecord(v));
  const hasObjectRows = objectEntries.length > 0;

  if (hasObjectRows) {
    const unionKeys = Array.from(
      objectEntries.reduce((acc, [, v]) => {
        Object.keys(v as Record<string, unknown>).forEach((k) => acc.add(k));
        return acc;
      }, new Set<string>()),
    ).slice(0, 8);

    if (unionKeys.length > 0) {
      return (
        <div className="overflow-auto rounded border border-[#232334]">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-[#232334] bg-[#0f0f17]">
              <tr>
                <th className="mono sticky left-0 bg-[#0f0f17] px-3 py-2 text-[11px] font-medium uppercase tracking-widest text-zinc-500">Source</th>
                {unionKeys.map((k) => (
                  <th key={k} className="mono whitespace-nowrap px-3 py-2 text-[11px] font-medium uppercase tracking-widest text-zinc-500">
                    {k}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#181825] bg-[#12121a]">
              {entries.map(([k, v]) => (
                <tr key={k} className="hover:bg-[#181825]/50">
                  <td className="mono sticky left-0 max-w-[280px] break-all bg-[#12121a] px-3 py-2 align-top font-medium text-zinc-200">{k}</td>
                  {unionKeys.map((uk) => {
                    const cell = isRecord(v) ? (v as Record<string, unknown>)[uk] : undefined;
                    return (
                      <td key={uk} className="whitespace-nowrap px-3 py-2 align-top">
                        {cell == null ? (
                          <span className="mono text-xs text-zinc-600">—</span>
                        ) : typeof cell === 'string' || typeof cell === 'number' || typeof cell === 'boolean' ? (
                          <Scalar value={cell} />
                        ) : Array.isArray(cell) ? (
                          <span className="mono text-xs text-zinc-400">{cell.length} items</span>
                        ) : isRecord(cell) ? (
                          <InlineValue value={cell} />
                        ) : (
                          <span className="mono text-xs text-zinc-600">—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
  }

  return (
    <div className="overflow-auto rounded border border-[#232334]">
      <table className="w-full text-left text-xs">
        <thead className="border-b border-[#232334] bg-[#0f0f17]">
          <tr>
            <th className="mono px-3 py-2 text-[11px] font-medium uppercase tracking-widest text-zinc-500">Key</th>
            <th className="mono px-3 py-2 text-[11px] font-medium uppercase tracking-widest text-zinc-500">Details</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#181825] bg-[#12121a]">
          {entries.map(([k, v]) => (
            <tr key={k} className="hover:bg-[#181825]/50">
              <td className="mono max-w-[260px] break-all px-3 py-2 align-top font-medium text-zinc-300">{k}</td>
              <td className="px-3 py-2 align-top">
                <InlineValue value={v} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PrimitiveCard({ label, value }: { label: string; value: unknown }) {
  if (value == null || isEmptyObject(value)) {
    return (
      <div className="rounded border border-dashed border-[#232334] bg-[#12121a] px-4 py-6 text-center">
        <p className="mono text-xs text-zinc-500">No data yet for {label}</p>
      </div>
    );
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return (
      <div className="rounded border border-[#232334] bg-[#12121a] px-4 py-4">
        <div className="mono text-[11px] uppercase tracking-widest text-zinc-500">{label}</div>
        <div className="mt-2">
          <Scalar value={value} />
        </div>
      </div>
    );
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return <p className="mono py-6 text-center text-xs text-zinc-500">No data yet</p>;
    const allPrimitive = value.every((v) => v == null || typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean');
    if (allPrimitive) {
      return (
        <div className="flex flex-wrap gap-2">
          {value.map((v, i) => (
            <span key={i} className="mono rounded border border-[#232334] bg-[#1c1c26] px-2.5 py-1.5 text-xs text-zinc-200">
              {v == null ? '—' : String(v)}
            </span>
          ))}
        </div>
      );
    }
    return (
      <div className="grid gap-2">
        {value.map((v, i) => (
          <div key={i} className="rounded border border-[#232334] bg-[#12121a] px-3 py-2">
            <InlineValue value={v} />
          </div>
        ))}
      </div>
    );
  }
  if (isRecord(value)) {
    return <MetricMap data={value} />;
  }
  return (
    <div className="rounded border border-[#232334] bg-[#0f0f17] px-4 py-6 text-center">
      <p className="mono text-xs text-zinc-500">Unsupported shape for {label}</p>
    </div>
  );
}

export default function Metrics() {
  void METRICS_SHOW;
  const [component, setComponent] = useState<string | undefined>(undefined);
  const [autoRefresh, setAutoRefresh] = useState(false);

  const caps = useCapabilities();
  const supported = caps.data?.[METRICS_SHOW]?.supported;
  const isUnsupported = supported === false;

  const { data, isLoading, error, refetch, isFetching } = useMetrics(component);

  useEffect(() => {
    if (!autoRefresh || isUnsupported) return;
    const id = window.setInterval(() => {
      void refetch();
    }, 30000);
    return () => window.clearInterval(id);
  }, [autoRefresh, isUnsupported, refetch]);

  const payload: MetricsPayload | undefined = data as MetricsPayload | undefined;

  if (isUnsupported) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-white">Metrics</h1>
            <p className="mono mt-1 text-xs text-zinc-500">Live counters from cscli metrics show. Filter by component or view all.</p>
          </div>
          <CapabilityBadge op={METRICS_SHOW} />
        </div>

        <Card className="border-amber-900/30 bg-amber-950/10">
          <CardContent className="pt-6">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="destructive" className="mono text-[11px]" role="status">
                unsupported
              </Badge>
              <span className="mono text-xs text-zinc-400">Metrics unavailable (cscli missing)</span>
            </div>
            <p className="mono mt-3 text-xs leading-5 text-zinc-500">
              The host probe for <span className="text-zinc-300">{METRICS_SHOW}</span> failed. Install or expose cscli and restart the dashboard. No metrics were fetched.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-white">Metrics</h1>
            <p className="mono mt-1 text-xs text-zinc-500">Live counters from cscli metrics show.</p>
          </div>
          <CapabilityBadge op={METRICS_SHOW} />
        </div>
        <LoadingSkeleton rows={8} />
      </>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-white">Metrics</h1>
            <p className="mono mt-1 text-xs text-zinc-500">Live counters from cscli metrics show.</p>
          </div>
          <CapabilityBadge op={METRICS_SHOW} />
        </div>
        <ErrorPanel error={error} onRetry={() => void refetch()} />
      </div>
    );
  }

  const isAll = component === undefined;
  let sections: Array<{ key: string; value: unknown }> = [];
  let emptyAll = false;

  if (payload) {
    if (isAll) {
      const presentKeys = METRICS_COMPONENTS.filter((k) => k in payload);
      const extraKeys = Object.keys(payload).filter((k) => !(METRICS_COMPONENTS as readonly string[]).includes(k));
      const ordered = [...presentKeys, ...extraKeys];
      if (ordered.length === 0) {
        emptyAll = Object.keys(payload).length === 0;
      } else {
        sections = ordered.map((k) => ({ key: k, value: (payload as Record<string, unknown>)[k] }));
      }
    } else {
      const key = component as string;
      const inner = (payload as Record<string, unknown>)[key] ?? payload;
      sections = [{ key, value: inner }];
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-white">Metrics</h1>
          <p className="mono mt-1 text-xs text-zinc-500">Live counters from cscli metrics show. Filter by component or view all.</p>
        </div>
        <CapabilityBadge op={METRICS_SHOW} />
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 pt-4">
          <div className="flex items-center gap-2">
            <Label htmlFor="metrics-component" className="mono text-[11px] uppercase tracking-widest text-zinc-500">
              Component
            </Label>
            <select
              id="metrics-component"
              aria-label="Select metrics component"
              value={component ?? 'all'}
              onChange={(e) => {
                const v = e.target.value;
                setComponent(v === 'all' ? undefined : v);
              }}
              className="mono h-8 rounded border border-[#232334] bg-[#0f0f17] px-2 py-1 text-xs text-zinc-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6366f1] focus-visible:ring-offset-2 focus-visible:ring-offset-[#09090f]"
            >
              <option value="all">All</option>
              {METRICS_COMPONENTS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <input
              id="metrics-autorefresh"
              type="checkbox"
              role="switch"
              aria-label="Auto-refresh metrics every 30 seconds"
              aria-checked={autoRefresh}
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="h-4 w-4 rounded border-[#232334] bg-[#0f0f17] text-[#6366f1] accent-[#6366f1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6366f1] focus-visible:ring-offset-2 focus-visible:ring-offset-[#09090f]"
            />
            <Label htmlFor="metrics-autorefresh" className="mono cursor-pointer text-xs text-zinc-400">
              Auto-refresh 30s
            </Label>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => void refetch()}
            disabled={isFetching}
            aria-label="Refresh metrics"
            aria-busy={isFetching || undefined}
            className="mono min-h-[32px] text-xs"
          >
            {isFetching ? 'Refreshing…' : 'Refresh'}
          </Button>

          {isFetching && !isLoading ? <span className="mono text-xs text-zinc-500">Updating…</span> : null}
        </CardContent>
      </Card>

      {isAll && emptyAll ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <h3 className="text-sm font-semibold tracking-tight text-white">No metrics yet</h3>
            <p className="mono mx-auto mt-2 max-w-md text-xs leading-5 text-zinc-500">
              The metrics snapshot is empty. CrowdSec may still be starting, or no parsers or scenarios have produced counters yet.
            </p>
          </CardContent>
        </Card>
      ) : sections.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <h3 className="text-sm font-semibold tracking-tight text-white">No data yet</h3>
            <p className="mono mx-auto mt-2 max-w-md text-xs leading-5 text-zinc-500">No counters for this component.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {sections.map(({ key, value }) => {
            const empty = value == null || isEmptyObject(value);
            const count = !empty && isRecord(value) ? Object.keys(value as Record<string, unknown>).length : Array.isArray(value) ? (value as unknown[]).length : 1;
            return (
              <Card key={key} className="overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between gap-3 border-b border-[#232334] bg-[#0f0f17] py-3">
                  <CardTitle className="mono text-xs font-medium uppercase tracking-widest text-zinc-300">{key}</CardTitle>
                  {empty ? (
                    <Badge variant="muted">empty</Badge>
                  ) : (
                    <Badge variant="secondary" className="mono text-[11px]">
                      {count} {count === 1 ? 'entry' : 'entries'}
                    </Badge>
                  )}
                </CardHeader>
                <CardContent className="pt-4">
                  <PrimitiveCard label={key} value={value} />
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <p className="sr-only" role="status" aria-live="polite">
        {isFetching ? 'Refreshing metrics' : 'Metrics loaded'}
      </p>
    </div>
  );
}
