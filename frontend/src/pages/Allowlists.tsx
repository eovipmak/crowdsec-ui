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
import { Search, CheckCircle, XCircle } from 'lucide-react';

export default function Allowlists() {
  const { data, isLoading, error, refetch } = useAllowlists();
  const [checkIp, setCheckIp] = useState('');
  const [submittedIp, setSubmittedIp] = useState<string | null>(null);
  const check = useAllowlistCheck(submittedIp);

  const handleCheck = () => {
    if (checkIp.trim()) setSubmittedIp(checkIp.trim());
  };

  if (isLoading) return <><CapabilityBadge op="allowlists.list" /><LoadingSkeleton rows={5} /></>;
  if (error) return <ErrorPanel error={error} onRetry={() => refetch()} />;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Allowlists</h1>
      <CapabilityBadge op="allowlists.list" />

      {/* Check IP card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Check IP</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              value={checkIp}
              onChange={(e) => setCheckIp(e.target.value)}
              placeholder="Enter IP or CIDR (e.g. 1.2.3.0/24)"
              className="max-w-sm"
              onKeyDown={(e) => e.key === 'Enter' && handleCheck()}
            />
            <Button onClick={handleCheck} disabled={check.isLoading}>
              <Search className="h-4 w-4 mr-1" /> Check
            </Button>
          </div>
          {submittedIp && !check.isLoading && check.data !== undefined && (
            <div className="mt-3 flex items-center gap-2">
              {check.data.matched ? (
                <Badge variant="default" className="gap-1"><CheckCircle className="h-3 w-3" /> Matched</Badge>
              ) : (
                <Badge variant="outline" className="gap-1"><XCircle className="h-3 w-3" /> Not matched</Badge>
              )}
              <span className="text-sm text-muted-foreground">IP: {submittedIp}</span>
            </div>
          )}
          {check.isError && (
            <p className="mt-3 text-sm text-destructive">Failed to check IP. {check.error?.message}</p>
          )}
        </CardContent>
      </Card>

      {/* Allowlist cards */}
      {!data || data.length === 0 ? (
        <EmptyState title="No allowlists" description="No allowlists configured." />
      ) : (
        <div className="grid gap-4">
          {data.map((al) => (
            <Card key={al.name}>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  {al.name}
                  <Badge variant="secondary">{al.size} entries</Badge>
                </CardTitle>
                <p className="text-sm text-muted-foreground">{al.description}</p>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">
                  Created: {al.created_at} · Updated: {al.updated_at}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}