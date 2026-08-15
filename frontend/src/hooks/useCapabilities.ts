import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api/client';

export type OpCap = { supported: boolean };
export type Capabilities = Record<string, OpCap>;

/**
 * Startup-probe capability map (plan §4.1 / §7.1). Cached in app.state on the
 * backend; each op reports `supported: true|false`. Task-10 uses this to gate
 * sections via CapabilityBadge (no data fetch for disabled ops).
 */
export function useCapabilities() {
  return useQuery<Capabilities>({
    queryKey: ['capabilities'],
    queryFn: () => apiGet<Capabilities>('/capabilities'),
  });
}
