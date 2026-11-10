import react from "@vitejs/plugin-react";
import type { Plugin } from "vite";
import { defineConfig } from "vite";

/** Local stand-in for Cursor app functions under /api/* */
function localApiPlugin(): Plugin {
  return {
    name: "local-api-drop-sync",
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith("/api/drop-sync")) return next();
        try {
          const mod = await server.ssrLoadModule("/api/drop-sync.ts");
          const url = new URL(req.url, "http://127.0.0.1");
          const chunks: Buffer[] = [];
          await new Promise<void>((resolve) => {
            req.on("data", (c) => chunks.push(Buffer.from(c)));
            req.on("end", () => resolve());
          });
          const body = Buffer.concat(chunks);
          const headers = new Headers();
          for (const [k, v] of Object.entries(req.headers)) {
            if (typeof v === "string") headers.set(k, v);
          }
          const request = new Request(url.toString(), {
            method: req.method,
            headers,
            body: req.method === "GET" || req.method === "HEAD" ? undefined : body,
          });
          const handler = req.method === "GET" ? mod.GET : mod.POST;
          const response: Response = await handler(request);
          res.statusCode = response.status;
          response.headers.forEach((v, k) => res.setHeader(k, v));
          const buf = Buffer.from(await response.arrayBuffer());
          res.end(buf);
        } catch (e) {
          res.statusCode = 500;
          res.setHeader("content-type", "application/json");
          res.end(JSON.stringify({ error: e instanceof Error ? e.message : "api error" }));
        }
      });
    },
  };
}

/** GitHub Pages project site lives at /Cliffscrm/; Cursor/local stay at /. */
const pagesBase = process.env.GITHUB_PAGES === "true" ? "/Cliffscrm/" : "/";

export default defineConfig({
  base: pagesBase,
  plugins: [react(), localApiPlugin()],
  optimizeDeps: {
    include: ["xlsx", "mammoth"],
  },
});
