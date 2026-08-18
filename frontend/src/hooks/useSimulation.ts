import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api/client';
import type { SimulationResult } from '@/lib/api/types';

export type { SimulationResult } from '@/lib/api/types';

export function useSimulation() {
  return useQuery<SimulationResult>({
    queryKey: ['simulation'],
    queryFn: () => apiGet<SimulationResult>('/simulation'),
  });
}
