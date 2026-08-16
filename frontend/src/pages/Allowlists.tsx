import { useState } from 'react';
import { useAllowlists, useAllowlistCheck } from '@/hooks/useAllowlists';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import ErrorPanel from '@/components/ErrorPanel';
import EmptyState from '@/components/EmptyState';
import LoadingSkeleton from '@/components/LoadingSkeleton';
import CapabilityBadge from '@/components/CapabilityBadge';

export default function Allowlists() {
  const { data, isLoading, error, refetch } = useAllowlists();
  const [checkIp, setCheckIp] = useState('');
  const [submittedIp, setSubmittedIp] = useState<string | null>(null);
  const check = useAllowlistCheck(submittedIp);

  const handleCheck = () => {
    if (checkIp.trim()) setSubmittedIp(checkIp.trim());
  };

  if (isLoading) return <><CapabilityBadge op="allowlists.list" /><div className="mt-3"><LoadingSkeleton rows={5} /></div></>;
  if (error) return <ErrorPanel error={error} onRetry={() => refetch()} />;

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
          <div className="flex gap-2">
            <Input
              value={checkIp}
              onChange={(e) => setCheckIp(e.target.value)}
              placeholder="1.2.3.0/24  or  203.0.113.10"
              className="max-w-sm mono tabular"
              onKeyDown={(e) => e.key === 'Enter' && handleCheck()}
            />
            <Button onClick={handleCheck} disabled={check.isLoading} className="mono text-xs tracking-wide">
              {check.isLoading ? 'Checking…' : 'Check'}
            </Button>
          </div>
          {submittedIp && !check.isLoading && check.data !== undefined && (
            <div className="mt-3 flex items-center gap-2">
              {check.data.matched ? (
                <Badge variant="success">Matched — exempt</Badge>
              ) : (
                <Badge variant="outline">Not matched</Badge>
              )}
              <span className="mono text-xs tabular text-zinc-500">{submittedIp}</span>
            </div>
          )}
          {check.isError && (
            <p className="mt-3 mono text-xs text-red-300">Failed to check. {check.error?.message}</p>
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
                <CardTitle className="mono text-sm font-medium tracking-tight text-white">{al.name}</CardTitle>
                <Badge variant="secondary" className="shrink-0">{al.size} entries</Badge>
              </CardHeader>
              <CardContent className="pt-3">
                {al.description ? <p className="text-xs leading-5 text-zinc-400">{al.description}</p> : null}
                <p className="mono mt-2 text-xs text-zinc-600">
                  Created {al.created_at} · Updated {al.updated_at}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
