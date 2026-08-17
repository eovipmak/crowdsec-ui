import { useEffect, useState } from 'react';
import { useHub } from '@/hooks/useHub';
import { HUB_LIST, type HubItem, type HubInventory } from '@/lib/api/types';
import { useCapabilities } from '@/hooks/useCapabilities';
import LoadingSkeleton from '@/components/LoadingSkeleton';
import ErrorPanel from '@/components/ErrorPanel';
import CapabilityBadge from '@/components/CapabilityBadge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

const ORDERED_TYPES = ['collections', 'parsers', 'scenarios', 'postoverflows'] as const;

function isStandardItem(item: unknown): item is HubItem {
  return !!item && typeof item === 'object' && typeof (item as Record<string, unknown>).name === 'string';
}

function titleCase(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function getStatusBadge(item: HubItem) {
  if (item.missing) {
    return <Badge variant="destructive">Missing</Badge>;
  }
  if (item.tainted) {
    return <Badge variant="signal">Tainted</Badge>;
  }
  if (item.latest_version && item.version && item.latest_version !== item.version) {
    return (
      <Badge variant="secondary" className="border-sky-900/40 bg-sky-950/40 text-sky-300">
        Update Available
      </Badge>
    );
  }
  if (item.status === 'enabled') {
    return <Badge variant="success">Enabled</Badge>;
  }
  if (item.status === 'disabled') {
    return <Badge variant="muted">Disabled</Badge>;
  }
  return item.status ? <Badge variant="muted">{item.status}</Badge> : <Badge variant="success">Ok</Badge>;
}

export default function Hub() {
  const [autoRefresh, setAutoRefresh] = useState(false);

  const caps = useCapabilities();
  const supported = caps.data?.[HUB_LIST]?.supported;
  const isUnsupported = supported === false;

  const { data, isLoading, error, refetch, isFetching } = useHub({
    enabled: !isUnsupported,
    refetchInterval: autoRefresh ? 30000 : false,
  });

  useEffect(() => {
    if (!autoRefresh || isUnsupported) return;
    const id = window.setInterval(() => {
      void refetch();
    }, 30000);
    return () => window.clearInterval(id);
  }, [autoRefresh, isUnsupported, refetch]);

  if (isUnsupported) {
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-white">Hub</h1>
            <p className="mono mt-1 text-xs text-zinc-500">
              Installed collections, parsers, scenarios, and postoverflows inventory.
            </p>
          </div>
          <CapabilityBadge op={HUB_LIST} />
        </div>

        <Card className="border-amber-900/30 bg-amber-950/10">
          <CardContent className="pt-6">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="destructive" className="mono text-[11px]" role="status">
                unsupported
              </Badge>
              <span className="mono text-xs text-zinc-400">Hub inventory unavailable (cscli missing)</span>
            </div>
            <p className="mono mt-3 text-xs leading-5 text-zinc-500">
              The host probe for <span className="text-zinc-300">{HUB_LIST}</span> failed. Install or expose cscli and restart the dashboard.
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
            <h1 className="text-xl font-semibold tracking-tight text-white">Hub</h1>
            <p className="mono mt-1 text-xs text-zinc-500">
              Installed collections, parsers, scenarios, and postoverflows inventory.
            </p>
          </div>
          <CapabilityBadge op={HUB_LIST} />
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
            <h1 className="text-xl font-semibold tracking-tight text-white">Hub</h1>
            <p className="mono mt-1 text-xs text-zinc-500">
              Installed collections, parsers, scenarios, and postoverflows inventory.
            </p>
          </div>
          <CapabilityBadge op={HUB_LIST} />
        </div>
        <ErrorPanel error={error} onRetry={() => void refetch()} />
      </div>
    );
  }

  const inventory: HubInventory = data ?? {};
  const allKeys = Object.keys(inventory);
  const orderedKeys = [
    ...ORDERED_TYPES.filter((k) => allKeys.includes(k)),
    ...allKeys.filter((k) => !(ORDERED_TYPES as readonly string[]).includes(k)).sort(),
  ];

  // Aggregated metrics
  let totalItems = 0;
  let taintedCount = 0;
  let missingCount = 0;
  let updateCount = 0;

  for (const key of allKeys) {
    const list = inventory[key];
    if (Array.isArray(list)) {
      for (const item of list) {
        if (isStandardItem(item)) {
          totalItems += 1;
          if (item.tainted) taintedCount += 1;
          if (item.missing) missingCount += 1;
          if (item.latest_version && item.version && item.latest_version !== item.version) {
            updateCount += 1;
          }
        }
      }
    }
  }

  const isEmpty = orderedKeys.length === 0 || totalItems === 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-white">Hub</h1>
          <p className="mono mt-1 text-xs text-zinc-500">
            Installed collections, parsers, scenarios, and postoverflows inventory.
          </p>
        </div>
        <CapabilityBadge op={HUB_LIST} />
      </div>

      {/* Control bar */}
      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-3 pt-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <input
                id="hub-autorefresh"
                type="checkbox"
                role="switch"
                aria-label="Auto-refresh hub inventory every 30 seconds"
                aria-checked={autoRefresh}
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="h-4 w-4 rounded border-[#232334] bg-[#0f0f17] text-[#6366f1] accent-[#6366f1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#6366f1] focus-visible:ring-offset-2 focus-visible:ring-offset-[#09090f]"
              />
              <Label htmlFor="hub-autorefresh" className="mono cursor-pointer text-xs text-zinc-400">
                Auto-refresh 30s
              </Label>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => void refetch()}
              disabled={isFetching}
              aria-label="Refresh hub inventory"
              aria-busy={isFetching || undefined}
              className="mono min-h-[32px] text-xs"
            >
              {isFetching ? 'Refreshing…' : 'Refresh'}
            </Button>

            {isFetching && !isLoading ? <span className="mono text-xs text-zinc-500">Updating…</span> : null}
          </div>

          {/* Status summary tags */}
          <div className="flex flex-wrap items-center gap-2">
            {taintedCount > 0 && (
              <Badge variant="signal" className="mono text-[11px]">
                {taintedCount} tainted
              </Badge>
            )}
            {missingCount > 0 && (
              <Badge variant="destructive" className="mono text-[11px]">
                {missingCount} missing
              </Badge>
            )}
            {updateCount > 0 && (
              <Badge variant="secondary" className="mono border-sky-900/40 bg-sky-950/40 text-[11px] text-sky-300">
                {updateCount} update{updateCount > 1 ? 's' : ''} available
              </Badge>
            )}
            <span className="mono text-xs text-zinc-500">
              {totalItems} item{totalItems !== 1 ? 's' : ''} total
            </span>
          </div>
        </CardContent>
      </Card>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {ORDERED_TYPES.map((type) => {
          const count = Array.isArray(inventory[type]) ? inventory[type].length : 0;
          return (
            <Card key={type}>
              <CardContent className="pt-4">
                <p className="mono text-[11px] uppercase tracking-widest text-zinc-500">{type}</p>
                <p className="mono mt-1 text-2xl font-semibold tracking-tight text-white">{count}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {isEmpty ? (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center">
            <h3 className="text-sm font-semibold tracking-tight text-white">No hub items</h3>
            <p className="mono mx-auto mt-2 max-w-md text-xs leading-5 text-zinc-500">
              No collections, parsers, or scenarios are installed or discovered by cscli.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {orderedKeys.map((typeKey) => {
            const rawList = inventory[typeKey];
            if (!Array.isArray(rawList) || rawList.length === 0) {
              return null;
            }

            return (
              <Card key={typeKey} className="overflow-hidden">
                <CardHeader className="flex flex-row items-center justify-between gap-3 border-b border-[#232334] bg-[#0f0f17] py-3">
                  <CardTitle className="mono text-xs font-medium uppercase tracking-widest text-zinc-300">
                    {titleCase(typeKey)}
                  </CardTitle>
                  <Badge variant="secondary" className="mono text-[11px]">
                    {rawList.length} item{rawList.length !== 1 ? 's' : ''}
                  </Badge>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b border-[#232334] bg-[#0f0f17]">
                        <tr>
                          <th className="mono px-3 py-2 text-[11px] font-medium uppercase tracking-widest text-zinc-500">
                            Name
                          </th>
                          <th className="mono px-3 py-2 text-[11px] font-medium uppercase tracking-widest text-zinc-500">
                            Version
                          </th>
                          <th className="mono px-3 py-2 text-[11px] font-medium uppercase tracking-widest text-zinc-500">
                            Status
                          </th>
                          <th className="mono px-3 py-2 text-[11px] font-medium uppercase tracking-widest text-zinc-500">
                            Description
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#181825] bg-[#12121a]">
                        {rawList.map((item, idx) => {
                          if (!isStandardItem(item)) {
                            return (
                              <tr key={idx} className="hover:bg-[#181825]/50">
                                <td colSpan={4} className="p-3">
                                  <pre className="mono overflow-auto rounded border border-[#232334] bg-[#09090f] p-2 text-xs leading-5 text-zinc-300">
                                    {JSON.stringify(item, null, 2)}
                                  </pre>
                                </td>
                              </tr>
                            );
                          }

                          const versionDisplay = (
                            <span className="mono text-xs text-zinc-400">
                              {item.version || (item as Record<string, unknown>).local_version ? (
                                <span>{item.version || String((item as Record<string, unknown>).local_version)}</span>
                              ) : (
                                <span className="text-zinc-600">—</span>
                              )}
                              {item.latest_version && item.version && item.latest_version !== item.version && (
                                <span className="ml-1 text-sky-400">→ {item.latest_version}</span>
                              )}
                            </span>
                          );

                          return (
                            <tr key={item.name || idx} className="hover:bg-[#181825]/50">
                              <td className="mono max-w-[240px] truncate px-3 py-2.5 font-medium text-zinc-200" title={item.name}>
                                {item.name}
                              </td>
                              <td className="mono whitespace-nowrap px-3 py-2.5">
                                {versionDisplay}
                              </td>
                              <td className="mono whitespace-nowrap px-3 py-2.5">
                                {getStatusBadge(item)}
                              </td>
                              <td className="max-w-[420px] truncate px-3 py-2.5 text-zinc-400" title={item.description || ''}>
                                {item.description || <span className="mono text-zinc-600">—</span>}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <p className="sr-only" role="status" aria-live="polite">
        {isFetching ? 'Refreshing hub inventory' : 'Hub inventory loaded'}
      </p>
    </div>
  );
}
