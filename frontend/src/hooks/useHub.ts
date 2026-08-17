import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { apiGet } from '@/lib/api/client';
import type { HubInventory } from '@/lib/api/types';

export interface UseHubOptions {
  enabled?: boolean;
  refetchInterval?: number | false;
}

export function useHub(options?: UseHubOptions): UseQueryResult<HubInventory, Error> {
  return useQuery<HubInventory, Error>({
    queryKey: ['hub'],
    queryFn: async () => {
      const result = await apiGet<HubInventory>('/hub');
      return result ?? ({} as HubInventory);
    },
    enabled: options?.enabled,
    refetchInterval: options?.refetchInterval,
  });
}
