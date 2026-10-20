/**
 * 负责独立视频预览应用配置；输入工具根、页面入口和已准备计划，输出 Vite 资源服务配置；不借用复盘应用的 cwd 或配置。
 * 用户项目先由准备器解析，Vite 只消费已准备素材和静态模块。
 */
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { videoPreviewPlugin } from "./scripts/video-preview-plugin";
export default defineConfig({
  root: fileURLToPath(new URL("./", import.meta.url)),
  plugins: [react(), videoPreviewPlugin()],
  server: { host: "127.0.0.1", port: 5173 },
});
