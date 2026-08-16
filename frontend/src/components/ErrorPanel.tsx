import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { AlertTriangle } from 'lucide-react';
import { ApiError } from '@/lib/api/client';

interface ErrorPanelProps {
  error: Error | ApiError;
  onRetry: () => void;
}

export default function ErrorPanel({ error, onRetry }: ErrorPanelProps) {
  const code = error instanceof ApiError ? error.code : null;
  const message = error.message || 'An unexpected error occurred.';

  return (
    <Card className="border-destructive/50">
      <CardContent className="flex items-center gap-4 pt-6">
        <AlertTriangle className="h-6 w-6 text-destructive shrink-0" />
        <div className="flex-1">
          <p className="font-medium text-destructive">Failed to load data</p>
          <p className="text-sm text-muted-foreground mt-1">
            {message}{code ? ` (Code: ${code})` : ''}
          </p>
        </div>
        <Button variant="outline" onClick={onRetry}>Retry</Button>
      </CardContent>
    </Card>
  );
}
