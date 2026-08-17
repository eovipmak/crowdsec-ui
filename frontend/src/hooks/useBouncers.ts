import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api/client';

export interface Bouncer {
  name: string;
  type: string;
  auth_type?: string;
  os?: string;
  version?: string;
  ip_address?: string;
  revoked?: boolean;
  auto_created?: boolean;
  created_at?: string;
  last_pull?: string;
}

export interface BouncerDetail {
  name: string;
  type: string;
  ip_address?: string;
  os?: string;
  version?: string;
  auth_type?: string;
  revoked?: boolean;
  auto_created?: boolean;
  created_at?: string;
  updated_at?: string;
  last_pull?: string;
  [key: string]: unknown;
}

export function useBouncers() {
  return useQuery<Bouncer[]>({
    queryKey: ['bouncers'],
    queryFn: () => apiGet<Bouncer[]>('/bouncers'),
  });
}

export function useBouncerInspect(name: string | null) {
  return useQuery<BouncerDetail>({
    enabled: name !== null && name.length > 0,
    queryKey: ['bouncers', 'inspect', name],
    queryFn: () => apiGet<BouncerDetail>(`/bouncers/inspect/${encodeURIComponent(name!)}`),
  });
}
