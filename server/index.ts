import 'dotenv/config';
import { initializeDatabase, pool } from './db';
import { createApiApplication, mountErrorHandler } from './apiApplication';
import { setupVite, serveStatic, log } from './vite';

(async () => {
  await initializeDatabase();
  const { app, server } = await createApiApplication();
  if (app.get('env') === 'development') await setupVite(app, server);
  else serveStatic(app);
  mountErrorHandler(app);
  let stopping = false;
  const shutdown = () => {
    if (stopping) return;
    stopping = true;
    server.close(() => { void pool.close().finally(() => process.exit(0)); });
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.on('SIGTERM', shutdown); process.on('SIGINT', shutdown);
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({ port, host: '0.0.0.0' }, () => log(`serving on port ${port}`));
})().catch(error => { console.error('Server startup failed', { type: error.name, code: error.code }); process.exit(1); });