import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api/client';

export function useStatusLapi() {
  return useQuery<boolean>({
    queryKey: ['status', 'lapi'],
    queryFn: async () => {
      const data = await apiGet<{ healthy: boolean }>('/status/lapi');
      return data.healthy;
    },
  });
}

export function useStatusCapi() {
  return useQuery<boolean>({
    queryKey: ['status', 'capi'],
    queryFn: async () => {
      const data = await apiGet<{ enabled: boolean }>('/status/capi');
      return data.enabled;
    },
  });
}