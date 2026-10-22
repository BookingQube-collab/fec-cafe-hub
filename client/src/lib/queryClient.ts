import { QueryClient, QueryFunction } from "@tanstack/react-query";
import type { AuthUser } from '@shared/schema';

export function cafeContextHeaders(): Record<string, string> {
  const user = queryClient.getQueryData<AuthUser>(['/api/auth/user']);
  return user?.cafeContext ? { 'X-Cafe-Context': user.cafeContext.id } : {};
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    let message = text;
    try {
      const body = JSON.parse(text);
      message = body.message || body.error || res.statusText;
    } catch { /* Some guarded routes return plain text. */ }
    if (res.status === 401) queryClient.setQueryData(['/api/auth/user'], null);
    throw new Error(res.status === 401 ? `401: ${message}` : message);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: { ...cafeContextHeaders(), ...(data ? { "Content-Type": "application/json" } : {}) },
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey, signal }) => {
    const res = await fetch(queryKey.join("/") as string, {
      credentials: "include",
      signal,
      headers: queryKey[0] === '/api/auth/user' ? {} : cafeContextHeaders(),
    });

    if (unauthorizedBehavior === "returnNull" && [401,403].includes(res.status)) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: true,
      staleTime: 30000,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
