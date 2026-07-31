import { createReadStream, existsSync } from "node:fs";
import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), {
    name: "replay-input-endpoint",
    configureServer(server) {
      const replayPath = process.env.AWA_REPLAY_INPUT;
      server.middlewares.use("/api/replay", (request, response, next) => {
        if (request.method !== "GET") return next();
        if (!replayPath || !existsSync(replayPath)) {
          response.statusCode = 404;
          response.setHeader("content-type", "application/json; charset=utf-8");
          response.end(JSON.stringify({ error: "replay_input_not_configured" }));
          return;
        }
        response.statusCode = 200;
        response.setHeader("content-type", "application/json; charset=utf-8");
        response.setHeader("cache-control", "no-store");
        createReadStream(replayPath).pipe(response);
      });
    },
  }],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    port: 5173,
    host: true,
  },
});
