import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api/client';

export interface Machine {
  machine_id: string;
  ip_address: string;
  os?: string;
  version?: string;
  auth_type?: string;
  validated: boolean;
  datasources?: any;
  created_at?: string;
  last_heartbeat?: string;
  last_push?: string;
}

export function useMachines() {
  return useQuery<Machine[]>({
    queryKey: ['machines'],
    queryFn: () => apiGet<Machine[]>('/machines'),
  });
}