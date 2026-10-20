/** 负责工作台浏览器构建；输入客户端模块，输出独立 dist。开发 API 代理到本机服务，不加载配置或运行模型。 */
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  server: { host: "127.0.0.1", port: 5174, proxy: { "/api": "http://127.0.0.1:4310" } },
  build: { outDir: "dist" },
});
