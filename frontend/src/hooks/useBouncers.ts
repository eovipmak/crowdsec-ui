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

export function useBouncers() {
  return useQuery<Bouncer[]>({
    queryKey: ['bouncers'],
    queryFn: () => apiGet<Bouncer[]>('/bouncers'),
  });
}