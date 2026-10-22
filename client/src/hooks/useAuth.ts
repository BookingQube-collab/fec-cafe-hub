import { useQuery } from "@tanstack/react-query";
import type { AuthUser } from "@shared/schema";
import { getQueryFn } from '@/lib/queryClient';

export function useAuth() {
  const { data: user, isLoading } = useQuery<AuthUser | null>({
    queryKey: ["/api/auth/user"],
    retry: false,
    staleTime: 30000,
    queryFn: getQueryFn({ on401: 'returnNull' }),
    refetchOnWindowFocus: true,
    refetchInterval: 60000,
  });

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
  };
}
