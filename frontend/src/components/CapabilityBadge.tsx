import { useCapabilities } from '@/hooks/useCapabilities';
import { Badge } from '@/components/ui/badge';

type CapabilityBadgeProps = {
  op: string;
};

/**
 * Per-section capability indicator (plan §7.1). When the section's op is
 * `supported: false`, call sites render this badge INSTEAD of the section so
 * no data fetch is attempted for disabled ops.
 */
export default function CapabilityBadge({ op }: CapabilityBadgeProps) {
  const caps = useCapabilities();
  const supported = caps.data?.[op]?.supported;

  if (supported === false) {
    return (
      <Badge variant="destructive">
        Unsupported — cscli probe failed for {op}
      </Badge>
    );
  }
  return <Badge variant="secondary">Supported</Badge>;
}
