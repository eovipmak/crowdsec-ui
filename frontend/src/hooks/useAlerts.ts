import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api/client';

export interface Alert {
  id: number;
  scenario: string;
  message: string;
  source_ip?: string;
  country?: string;
  as_name?: string;
  events_count?: number;
  created_at?: string;
  log_type?: string;
  service?: string;
  machine?: string;
  decisions?: { type: string; duration: string }[];
}

export function useAlerts(opts: { limit?: number; scenario?: string; ip?: string }) {
  return useQuery<Alert[]>({
    queryKey: ['alerts', opts],
    queryFn: () => apiGet<Alert[]>('/alerts', opts as Record<string, string | number>),
  });
}

export function useAlert(id: number | null) {
  return useQuery<Alert & { events?: any[] }>({
    enabled: id !== null,
    queryKey: ['alert', id],
    queryFn: () => apiGet<Alert & { events?: any[] }>(`/alerts/inspect/${id}`),
  });
}