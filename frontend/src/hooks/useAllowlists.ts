import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api/client';

export interface Allowlist {
  name: string;
  description: string;
  created_at?: string;
  updated_at?: string;
  size: number;
}

export interface AllowlistItem {
  value: string;
  description: string;
  created_at: string;
  expiration: string;
}

export interface AllowlistDetail extends Allowlist {
  items: AllowlistItem[];
}

export function useAllowlists() {
  return useQuery<Allowlist[]>({
    queryKey: ['allowlists'],
    queryFn: () => apiGet<Allowlist[]>('/allowlists'),
  });
}

export function useAllowlistCheck(ip: string | null) {
  return useQuery<{ matched: boolean }>({
    enabled: ip !== null && ip.length > 0,
    queryKey: ['allowlists', 'check', ip],
    queryFn: () => apiGet<{ matched: boolean }>(`/allowlists/check/${encodeURIComponent(ip!)}`),
  });
}

export function useAllowlistInspect(name: string | null) {
  return useQuery<AllowlistDetail>({
    enabled: name !== null && name.length > 0,
    queryKey: ['allowlists', 'inspect', name],
    queryFn: () => apiGet<AllowlistDetail>(`/allowlists/inspect/${encodeURIComponent(name!)}`),
  });
}