import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type * as schema from '@shared/schema';
import { workerContext } from './workerContext';

// Each request owns its connection; never reuse a socket from another invocation.
export const db = new Proxy({} as NodePgDatabase<typeof schema>, {
  get(_target, property) {
    const active = workerContext().db;
    const value = Reflect.get(active, property);
    return typeof value === 'function' ? value.bind(active) : value;
  },
});
