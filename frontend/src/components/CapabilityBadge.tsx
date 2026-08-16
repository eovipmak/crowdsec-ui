import { Badge } from '@/components/ui/badge';
import { useCapabilities } from '@/hooks/useCapabilities';
import { AlertCircle, CheckCircle2 } from 'lucide-react';

interface CapabilityBadgeProps {
  op: string;
}

export default function CapabilityBadge({ op }: CapabilityBadgeProps) {
  const caps = useCapabilities();
  const supported = caps.data?.[op]?.supported;

  if (supported === undefined) return null;

  return (
    <div className="flex items-center gap-2 py-2">
      {supported ? (
        <Badge variant="default" className="gap-1">
          <CheckCircle2 className="h-3 w-3" /> Supported
        </Badge>
      ) : (
        <Badge variant="destructive" className="gap-1">
          <AlertCircle className="h-3 w-3" /> Unsupported — cscli probe failed
        </Badge>
      )}
    </div>
  );
}
