/**
 * 负责前端构建配置与开发／生产预览复盘读取端点。输入为 Vite 请求及启动时的归档路径，输出前端资源或原文件字节流。
 * 仅 GET 消费该端点，缺路径返回有限 404；此处不解析归档内容，也不授予游戏行动或持久化写权。
 */
import { createReadStream } from "node:fs";
import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig, type ViteDevServer, type PreviewServer } from "vite";

/** 开发和 preview 共用同一个只读端点；静态部署仍可通过浏览器导入文件。 */
function installReplayEndpoint(server: ViteDevServer | PreviewServer) {
  const replayPath = process.env.AWA_REPLAY_INPUT;
  server.middlewares.use("/api/replay", (request, response) => {
    response.setHeader("content-type", "application/json; charset=utf-8");
    response.setHeader("cache-control", "no-store");
    if (request.method !== "GET") {
      response.statusCode = 405;
      response.setHeader("allow", "GET");
      response.end(JSON.stringify({ error: "method_not_allowed" }));
      return;
    }
    if (!replayPath) {
      response.statusCode = 404;
      response.end(JSON.stringify({ error: "replay_input_not_configured" }));
      return;
    }
    const stream = createReadStream(replayPath);
    // 先打开再发送成功响应；缺失、目录或不可读输入不会变成挂起的 200／未处理异常。
    stream.once("readable", () => {
      response.statusCode = 200;
      stream.pipe(response);
    });
    stream.once("error", (error: NodeJS.ErrnoException) => {
      if (response.headersSent) {
        response.destroy(error);
        return;
      }
      response.statusCode = error.code === "ENOENT" ? 404 : 500;
      response.end(JSON.stringify({ error: "replay_input_unreadable" }));
    });
    response.once("close", () => stream.destroy());
  });
}

export default defineConfig({
  root: fileURLToPath(new URL("./", import.meta.url)),
  plugins: [
    react(),
    {
      name: "replay-input-endpoint",
      configureServer: installReplayEndpoint,
      configurePreviewServer: installReplayEndpoint,
    },
  ],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("../../packages/game-media/src", import.meta.url)),
    },
  },
  build: {
    rollupOptions: {
      input: {
        replay: fileURLToPath(new URL("./index.html", import.meta.url)),
      },
    },
  },
  server: {
    port: 5173,
    host: true,
  },
});
