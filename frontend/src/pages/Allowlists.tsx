import { useState } from 'react';
import { useAllowlists, useAllowlistCheck, useAllowlistInspect, type AllowlistItem } from '@/hooks/useAllowlists';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import DataTable, { type Column } from '@/components/DataTable';
import ErrorPanel from '@/components/ErrorPanel';
import EmptyState from '@/components/EmptyState';
import LoadingSkeleton from '@/components/LoadingSkeleton';
import CapabilityBadge from '@/components/CapabilityBadge';

function isNeverExpire(v: string | null | undefined): boolean {
  return !v || v === '0001-01-01T00:00:00.000Z';
}

export default function Allowlists() {
  const { data, isLoading, error, refetch } = useAllowlists();
  const [checkIp, setCheckIp] = useState('');
  const [submittedIp, setSubmittedIp] = useState<string | null>(null);
  const check = useAllowlistCheck(submittedIp);
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const inspect = useAllowlistInspect(selectedName);

  const handleCheck = () => {
    if (checkIp.trim()) setSubmittedIp(checkIp.trim());
  };

  const itemColumns: Column<AllowlistItem>[] = [
    { key: 'value', header: 'Value', className: 'mono tabular break-all' },
    { key: 'description', header: 'Description', className: 'break-words text-xs' },
    { key: 'created_at', header: 'Created At', className: 'mono text-xs tabular whitespace-nowrap' },
    {
      key: 'expiration',
      header: 'Expiration',
      className: 'mono text-xs tabular whitespace-nowrap',
      render: (row) => (isNeverExpire(row.expiration) ? '— never' : row.expiration),
    },
  ];

  if (isLoading) return <><CapabilityBadge op="allowlists.list" /><div className="mt-3"><LoadingSkeleton rows={5} /></div></>;
  if (error) return <ErrorPanel error={error} onRetry={() => refetch()} />;

  const showResult = submittedIp && !check.isLoading && check.data !== undefined;
  const inspectItems: AllowlistItem[] = Array.isArray(inspect.data?.items) ? inspect.data.items : [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-white">Allowlists</h1>
          <p className="mono mt-1 text-xs text-zinc-500">CIDR and IP exceptions exempted from blocking.</p>
        </div>
        <CapabilityBadge op="allowlists.list" />
      </div>

      <Card>
        <CardHeader className="border-b border-[#232334] bg-[#0f0f17] py-3">
          <CardTitle className="mono text-xs font-medium uppercase tracking-widest text-zinc-300">Check IP</CardTitle>
          <p className="mono text-xs text-zinc-600">Test whether an address matches any allowlist entry.</p>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-0 flex-1">
              <Label htmlFor="check-ip" className="mono text-[11px] uppercase tracking-widest text-zinc-500">IP or CIDR</Label>
              <Input
                id="check-ip"
                value={checkIp}
                onChange={(e) => setCheckIp(e.target.value)}
                placeholder="1.2.3.0/24  or  203.0.113.10"
                aria-label="IP or CIDR to check"
                aria-invalid={check.isError ? true : undefined}
                aria-describedby={check.isError ? 'check-ip-error' : showResult ? 'check-ip-result' : undefined}
                className="mt-1 max-w-sm mono tabular"
                onKeyDown={(e) => e.key === 'Enter' && handleCheck()}
              />
            </div>
            <Button
              onClick={handleCheck}
              disabled={!checkIp.trim() || check.isLoading}
              aria-label="Check IP against allowlists"
              aria-busy={check.isLoading || undefined}
              className="mono min-h-[32px] text-xs tracking-wide"
            >
              {check.isLoading ? 'Checking…' : 'Check'}
            </Button>
          </div>
          {showResult && (
            <div id="check-ip-result" role="status" aria-live="polite" className="mt-3 flex flex-wrap items-center gap-2">
              {check.data.matched ? (
                <Badge variant="success">Matched — exempt</Badge>
              ) : (
                <Badge variant="outline">Not matched</Badge>
              )}
              <span className="mono break-all text-xs tabular text-zinc-500">{submittedIp}</span>
            </div>
          )}
          {check.isError && (
            <p id="check-ip-error" role="alert" className="mt-3 mono text-xs text-red-300">Failed to check. {check.error?.message}</p>
          )}
        </CardContent>
      </Card>

      {!data || data.length === 0 ? (
        <EmptyState
          title="No allowlists"
          description="No allowlists are configured. Create one to exempt trusted networks from automatic blocks."
          action="Example: allow your office egress or monitoring probes."
        />
      ) : (
        <div className="grid gap-3">
          {data.map((al) => (
            <Card key={al.name} className="overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between gap-3 border-b border-[#232334] bg-[#0f0f17] py-3">
                <CardTitle className="mono min-w-0 break-all text-sm font-medium tracking-tight text-white">{al.name}</CardTitle>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge variant="secondary" className="shrink-0">{al.size} entries</Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedName(al.name)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSelectedName(al.name);
                      }
                    }}
                    aria-label={`View entries for ${al.name}`}
                    className="mono min-h-[32px] shrink-0 border-[#232334] bg-[#09090f] text-xs tracking-wide text-zinc-300 hover:bg-[#181825] hover:text-white"
                  >
                    View entries ({al.size})
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-3">
                {al.description ? <p className="break-words text-xs leading-5 text-zinc-400">{al.description}</p> : null}
                <p className="mono mt-2 break-words text-xs text-zinc-600">
                  Created {al.created_at} · Updated {al.updated_at}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={selectedName !== null} onOpenChange={(open) => { if (!open) setSelectedName(null); }}>
        <DialogContent className="max-h-[82vh] w-[calc(100%-32px)] max-w-3xl overflow-hidden bg-[#09090f] p-0 sm:w-full">
          <DialogHeader>
            <DialogTitle className="mono pr-8 text-sm">{selectedName ?? 'Allowlist'}</DialogTitle>
            <DialogDescription>Entries for this allowlist — Value, description and expiration.</DialogDescription>
          </DialogHeader>

          <div className="max-h-[68vh] overflow-y-auto overflow-x-hidden px-5 py-4">
            {inspect.isLoading && <LoadingSkeleton rows={3} />}
            {inspect.error && <ErrorPanel error={inspect.error as Error} onRetry={() => inspect.refetch()} />}
            {inspect.data && !inspect.isLoading && !inspect.error && (
              <div className="space-y-4">
                <div className="rounded border border-[#232334] bg-[#0f0f17] p-3">
                  {inspect.data.description ? (
                    <p className="break-words text-xs leading-5 text-zinc-400">{inspect.data.description}</p>
                  ) : (
                    <p className="mono text-xs text-zinc-600">No description</p>
                  )}
                  <p className="mono mt-2 break-words text-xs text-zinc-600">
                    Created {inspect.data.created_at ?? '—'} · Updated {inspect.data.updated_at ?? '—'}
                  </p>
                </div>

                {inspectItems.length === 0 ? (
                  <p className="mono rounded border border-dashed border-[#232334] bg-[#0f0f17]/60 px-4 py-8 text-center text-xs text-zinc-500">No entries in this allowlist</p>
                ) : (
                  <DataTable data={inspectItems} columns={itemColumns} rowKey={(row) => row.value} />
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
