import { useAlert } from '@/hooks/useAlerts';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
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
    { key: 'timestamp', header: 'Timestamp' },
    { key: 'log_type', header: 'Log Type' },
    { key: 'service', header: 'Service' },
    { key: 'machine', header: 'Machine' },
    { key: 'source_ip', header: 'Source IP' },
    { key: 'target_user', header: 'Target User' },
    { key: 'datasource_path', header: 'Datasource' },
  ];

  return (
    <Dialog open={id !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Alert #{id}</DialogTitle>
        </DialogHeader>
        {isLoading && <LoadingSkeleton rows={4} />}
        {error && <ErrorPanel error={error} onRetry={() => refetch()} />}
        {data && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div><span className="font-medium">Scenario:</span> {data.scenario}</div>
              <div><span className="font-medium">Source IP:</span> {data.source_ip ?? '—'}</div>
              <div><span className="font-medium">Country:</span> {data.country ?? '—'}</div>
              <div><span className="font-medium">AS Name:</span> {data.as_name ?? '—'}</div>
              <div><span className="font-medium">Events:</span> {data.events_count ?? 0}</div>
              <div><span className="font-medium">Created:</span> {data.created_at ?? '—'}</div>
              <div className="col-span-2"><span className="font-medium">Message:</span> {data.message}</div>
            </div>
            {data.decisions && data.decisions.length > 0 && (
              <div>
                <h4 className="font-medium mb-2">Decisions</h4>
                <div className="flex flex-wrap gap-2">
                  {data.decisions.map((d, i) => (
                    <Badge key={i} variant="outline">{d.type}: {d.duration}</Badge>
                  ))}
                </div>
              </div>
            )}
            {data.events && data.events.length > 0 && (
              <div>
                <h4 className="font-medium mb-2">Events ({data.events.length})</h4>
                <DataTable data={data.events} columns={eventColumns} />
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}