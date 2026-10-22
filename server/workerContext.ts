import { AsyncLocalStorage } from 'node:async_hooks';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type * as schema from '@shared/schema';

export interface WorkerEnvironment {
  APPLICATION_SURFACE: 'public' | 'management';
  HYPERDRIVE: { connectionString: string };
  ASSETS: { fetch(request: Request): Promise<Response> };
  SESSION_SECRET: string;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  STORAGE_BUCKET: string;
  PASSWORD_SERVICE_SECRET: string;
}
export interface WorkerRequestContext {
  db: NodePgDatabase<typeof schema>;
  env: WorkerEnvironment;
  pending: Promise<unknown>[];
}
export const workerRequests = new AsyncLocalStorage<WorkerRequestContext>();
export function workerContext() {
  const context = workerRequests.getStore();
  if (!context) throw new Error('Worker services require an active request');
  return context;
}
// Finish listeners must complete before the request's DB connection is closed.
export function deferRequestTask(task: Promise<unknown>) {
  const guarded = task.catch(error => console.error('Deferred request task failed', { type: error?.name, code: error?.code }));
  workerRequests.getStore()?.pending.push(guarded);
  return guarded;
}
