import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api/client';
import { METRICS_SHOW } from '@/lib/api/types';

export type MetricsPayload = Record<string, unknown>;

export function useMetrics(component?: string) {
  void METRICS_SHOW;
  return useQuery<MetricsPayload>({
    queryKey: ['metrics', component ?? 'all'],
    queryFn: () => apiGet<MetricsPayload>(component ? `/metrics/${component}` : '/metrics'),
  });
}
