import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api/client';

export interface Decision {
  id: number;
  scenario: string;
  message?: string;
  created_at?: string;
  source_ip?: string;
  country?: string;
  as_name?: string;
  type: string;
  value: string;
  scope?: string;
  duration?: string;
  origin?: string;
  simulated?: boolean;
}

export function useDecisions(opts: { limit?: number; type?: string; ip?: string }) {
  return useQuery<Decision[]>({
    queryKey: ['decisions', opts],
    queryFn: () => apiGet<Decision[]>('/decisions', opts as Record<string, string | number>),
  });
}