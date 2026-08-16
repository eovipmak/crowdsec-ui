import { useAlerts } from '@/hooks/useAlerts';
import { useDecisions } from '@/hooks/useDecisions';
import { useMachines } from '@/hooks/useMachines';
import { useStatusLapi, useStatusCapi } from '@/hooks/useStatus';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import CapabilityBadge from '@/components/CapabilityBadge';
import ErrorPanel from '@/components/ErrorPanel';
import LoadingSkeleton from '@/components/LoadingSkeleton';
import { Shield, AlertTriangle, Server, Activity } from 'lucide-react';

export default function Overview() {
  const alerts = useAlerts({ limit: 1 });
  const decisions = useDecisions({ limit: 1 });
  const machines = useMachines();
  const lapi = useStatusLapi();
  const capi = useStatusCapi();

  const loading = alerts.isLoading || decisions.isLoading || machines.isLoading;
  const error = alerts.error || decisions.error || machines.error;

  if (loading) return <LoadingSkeleton rows={4} />;
  if (error) return <ErrorPanel error={error} onRetry={() => { alerts.refetch(); decisions.refetch(); machines.refetch(); }} />;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Overview</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Alerts</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{alerts.data?.length ?? 0}</div>
            <CapabilityBadge op="alerts.list" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Decisions</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{decisions.data?.length ?? 0}</div>
            <CapabilityBadge op="decisions.list" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Machines</CardTitle>
            <Server className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{machines.data?.length ?? 0}</div>
            <CapabilityBadge op="machines.list" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">LAPI / CAPI</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent className="flex gap-2">
            <Badge variant={lapi.data ? 'default' : 'destructive'}>
              LAPI: {lapi.data ? 'Healthy' : 'Down'}
            </Badge>
            <Badge variant={capi.data ? 'default' : 'destructive'}>
              CAPI: {capi.data ? 'Enabled' : 'Disabled'}
            </Badge>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}