import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { type Server } from "http";
import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

export async function setupVite(app: Express, server: Server) {
  // Keep build tooling outside the production server's dependency graph.
  const { createServer: createViteServer, createLogger } = await import('vite');
  const { default: importedConfig } = await import(pathToFileURL(path.resolve('vite.config.ts')).href);
  // vite.config may export a defineConfig callback; spreading the function itself
  // drops root/plugins/aliases and makes /src/main.tsx resolve from the repo root.
  const mode = process.env.NODE_ENV === "production" ? "production" : "development";
  const viteConfig =
    typeof importedConfig === "function"
      ? await importedConfig({ command: "serve", mode })
      : importedConfig;
  const viteLogger = createLogger();
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: ["localhost", "127.0.0.1"],
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      },
    },
    server: {
      ...viteConfig.server,
      ...serverOptions,
    },
    appType: "custom",
  });

  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html",
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${randomUUID()}"`,
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  const distPath = path.resolve(import.meta.dirname, "public");

  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(express.static(distPath, { setHeaders(res, file) {
    if (file.endsWith('.html')) res.setHeader('Cache-Control', 'no-store');
  } }));

  // fall through to index.html if the file doesn't exist
  app.use("*", (_req, res) => {
    res.set('Cache-Control', 'no-store').sendFile(path.resolve(distPath, "index.html"));
  });
}
