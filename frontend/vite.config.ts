/**
 * 负责前端构建配置与开发态复盘读取端点。输入为 Vite 请求及启动时的归档路径，输出前端资源或原文件字节流。
 * 仅 GET 消费该端点，缺路径返回有限 404；此处不解析归档内容，也不授予游戏行动或持久化写权。
 */
import { createReadStream, existsSync } from "node:fs";
import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    react(),
    {
      name: "replay-input-endpoint",
      configureServer(server) {
        // 路径在服务器装配时捕获；每次 GET 另查存在性并流式读取，不把文档内容缓存在配置中。
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
    },
  ],
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
