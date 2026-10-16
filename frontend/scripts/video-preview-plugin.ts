/**
 * 负责显式视频预览的 Vite 文件端点与自定义图层模块。输入为启动时捕获的准备目录，输出计划和登记素材字节。
 * 请求路径只能命中准备目录中的精确文件，不接受外来磁盘路径；开发与生产预览共用读取边界，不生成 TTS。
 */
import { createReadStream, existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { searchForWorkspaceRoot, type Plugin, type Connect } from "vite";

export function videoPreviewPlugin(): Plugin {
  const directory = process.env.AWA_VIDEO_PLAN_DIR;
  const projectPath = process.env.AWA_VIDEO_PROJECT_ENTRY;
  const id = "./video-layer-registry",
    resolved = "\0awa-video-layers";
  // Vite 默认由 Node 加载配置；使用标准模块 URL，兼容打包配置和 Bun 原生启动两条路径。
  const registryPath = fileURLToPath(new URL("../src/video-layer-registry.ts", import.meta.url));
  const install = (middlewares: Connect.Server) => {
    middlewares.use("/api/video", async (request, response, next) => {
      if (request.method !== "GET") return next();
      const missing = () => {
        response.statusCode = 404;
        response.setHeader("content-type", "application/json");
        response.end(JSON.stringify({ error: "video_not_prepared" }));
      };
      if (!directory) return missing();
      const url = request.url?.split("?")[0];
      if (url === "/plan") {
        try {
          const plan = await readFile(path.join(directory, "plan.json"));
          response.setHeader("content-type", "application/json; charset=utf-8");
          response.setHeader("cache-control", "no-store");
          response.end(plan);
        } catch {
          missing();
        }
        return;
      }
      // 素材名称由准备器的 SHA256 与有限扩展名组成；拒绝编码穿越、目录和任意文件查询。
      if (!url || !/^\/assets\/[a-f0-9]{64}\.[a-z0-9]+$/.test(url)) return missing();
      const file = path.join(directory, url.slice(1));
      if (!existsSync(file)) return missing();
      const mime: Record<string, string> = {
        ".wav": "audio/wav",
        ".mp3": "audio/mpeg",
        ".m4a": "audio/mp4",
        ".ogg": "audio/ogg",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".webp": "image/webp",
        ".svg": "image/svg+xml",
        ".mp4": "video/mp4",
        ".woff2": "font/woff2",
        ".woff": "font/woff",
        ".ttf": "font/ttf",
        ".otf": "font/otf",
        ".ttc": "font/collection",
      };
      response.setHeader("content-type", mime[path.extname(file)] ?? "application/octet-stream");
      const stream = createReadStream(file);
      stream.on("error", () => {
        if (!response.headersSent) response.statusCode = 404;
        response.end();
      });
      response.on("close", () => stream.destroy());
      stream.pipe(response);
    });
  };
  return {
    name: "awa-video-preview",
    // 在 Vite 的普通文件解析之前替换注册表，保证 preview 与导出使用相同的 TSX 模块。
    enforce: "pre",
    config() {
      if (projectPath)
        return {
          server: {
            fs: { allow: [searchForWorkspaceRoot(process.cwd()), path.dirname(projectPath)] },
          },
        };
    },
    resolveId(source, importer) {
      if (
        projectPath &&
        ((source === id && importer?.split("?")[0]?.endsWith("/video-preview.tsx")) ||
          source === registryPath ||
          source === "/src/video-layer-registry.ts")
      )
        return resolved;
    },
    load(source) {
      if (source !== resolved) return;
      return projectPath
        ? `import * as project from ${JSON.stringify(projectPath)}; export const themeSlots = project.themeSlots ?? {}; export default project.layers ?? {};`
        : "export const themeSlots = {}; export default {};";
    },
    configureServer(server) {
      install(server.middlewares);
    },
    configurePreviewServer(server) {
      install(server.middlewares);
    },
  };
}
