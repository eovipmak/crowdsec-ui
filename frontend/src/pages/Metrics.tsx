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

function ComponentSection({ rawValue }: { rawValue: unknown }) {
  if (rawValue == null || isEmptyObject(rawValue)) {
    return <p className="mono py-6 text-center text-xs text-zinc-500">No data yet</p>;
  }

  if (typeof rawValue !== 'object' || Array.isArray(rawValue)) {
    return (
      <pre className="mono overflow-auto rounded border border-[#232334] bg-[#09090f] p-3 text-xs leading-5 text-zinc-300">
        {JSON.stringify(rawValue, null, 2)}
      </pre>
    );
  }

  const entries = Object.entries(rawValue as Record<string, unknown>);
  if (entries.length === 0) {
    return <p className="mono py-6 text-center text-xs text-zinc-500">No data yet</p>;
  }

  try {
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
                <td className="mono max-w-[260px] break-all px-3 py-2 align-top text-zinc-300">{k}</td>
                <td className="mono break-all px-3 py-2 align-top text-zinc-400">
                  {v == null ? (
                    <span className="text-zinc-600">—</span>
                  ) : typeof v === 'object' && !Array.isArray(v) ? (
                    <span className="flex flex-wrap gap-x-3 gap-y-1">
                      {Object.entries(v as Record<string, unknown>).map(([sk, sv]) => (
                        <span key={sk} className="inline-flex gap-1">
                          <span className="text-zinc-500">{sk}:</span>
                          <span className="text-zinc-300">
                            {sv == null ? '—' : typeof sv === 'object' ? JSON.stringify(sv) : String(sv)}
                          </span>
                        </span>
                      ))}
                      {Object.keys(v as Record<string, unknown>).length === 0 ? (
                        <span className="text-zinc-600">—</span>
                      ) : null}
                    </span>
                  ) : Array.isArray(v) ? (
                    JSON.stringify(v)
                  ) : (
                    String(v)
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  } catch {
    return (
      <pre className="mono overflow-auto rounded border border-[#232334] bg-[#09090f] p-3 text-xs leading-5 text-zinc-300">
        {JSON.stringify(rawValue, null, 2)}
      </pre>
    );
  }
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
              The metrics snapshot is empty. CrowdSec may still be starting, or no parsers/scenarios have produced counters yet.
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
            return (
              <Card key={key} className="overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between gap-3 border-b border-[#232334] bg-[#0f0f17] py-3">
                  <CardTitle className="mono text-xs font-medium uppercase tracking-widest text-zinc-300">{key}</CardTitle>
                  {empty ? (
                    <Badge variant="muted">empty</Badge>
                  ) : (
                    <Badge variant="secondary" className="mono text-[11px]">
                      {Array.isArray(value) ? (value as unknown[]).length : typeof value === 'object' ? Object.keys(value as Record<string, unknown>).length : 1} entries
                    </Badge>
                  )}
                </CardHeader>
                <CardContent className="pt-4">
                  {empty ? (
                    <p className="mono py-4 text-center text-xs text-zinc-500">No data yet</p>
                  ) : typeof value !== 'object' || Array.isArray(value) || value == null ? (
                    <pre className="mono overflow-auto rounded border border-[#232334] bg-[#09090f] p-3 text-xs leading-5 text-zinc-300">
                      {JSON.stringify(value, null, 2)}
                    </pre>
                  ) : (
                    <ComponentSection rawValue={value} />
                  )}
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
