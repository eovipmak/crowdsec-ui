import { Badge } from '@/components/ui/badge';
import { useCapabilities } from '@/hooks/useCapabilities';

interface CapabilityBadgeProps {
  op: string;
}

export default function CapabilityBadge({ op }: CapabilityBadgeProps) {
  const caps = useCapabilities();
  const supported = caps.data?.[op]?.supported;

  if (supported === undefined) return null;

  return (
    <div className="flex items-center gap-2">
      {supported ? (
        <span className="mono inline-flex items-center gap-1.5 text-[11px] uppercase tracking-widest text-zinc-500" aria-label="cscli ready">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
          cscli · ready
        </span>
      ) : (
        <Badge variant="destructive" className="mono text-[11px]" role="status">Unsupported — cscli probe failed</Badge>
      )}
    </div>
  );
}
