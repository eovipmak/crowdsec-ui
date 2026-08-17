import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api/client';

export interface Machine {
  machine_id: string;
  ip_address: string;
  os?: string;
  version?: string;
  auth_type?: string;
  validated: boolean;
  datasources?: unknown;
  created_at?: string;
  last_heartbeat?: string;
  last_push?: string;
}

export interface MachineDetail {
  machineId?: string;
  machine_id?: string;
  ipAddress?: string;
  ip_address?: string;
  os?: string;
  version?: string;
  isValidated?: boolean;
  validated?: boolean;
  auth_type?: string;
  created_at?: string;
  updated_at?: string;
  last_heartbeat?: string;
  last_push?: string;
  datasources?: unknown;
  metrics?: unknown;
  [key: string]: unknown;
}

export function useMachines() {
  return useQuery<Machine[]>({
    queryKey: ['machines'],
    queryFn: () => apiGet<Machine[]>('/machines'),
  });
}

export function useMachineInspect(machineId: string | null) {
  return useQuery<MachineDetail>({
    enabled: machineId !== null && machineId.length > 0,
    queryKey: ['machines', 'inspect', machineId],
    queryFn: () => apiGet<MachineDetail>(`/machines/inspect/${encodeURIComponent(machineId!)}`),
  });
}
