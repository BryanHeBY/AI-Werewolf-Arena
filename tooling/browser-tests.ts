/**
 * 负责跨平台浏览器测试启动。输入为应用工作目录和 Playwright 参数，输出原进程退出码。
 * 仅在子进程环境移除代理变量，保留调用目录；不修改用户环境、不解释 shell 命令。
 */
import path from "node:path";
const directory = path.resolve(process.argv[2]);
const env = { ...process.env };
for (const key of [
  "http_proxy",
  "https_proxy",
  "all_proxy",
  "HTTP_PROXY",
  "HTTPS_PROXY",
  "ALL_PROXY",
])
  delete env[key];
env.PLAYWRIGHT_HTML_OPEN = "never";
// Playwright 由官方支持的 Node 运行；Bun 仅负责跨平台启动和环境隔离。
const child = Bun.spawn(
  [
    "node",
    path.join(directory, "node_modules/@playwright/test/cli.js"),
    "test",
    ...process.argv.slice(3),
  ],
  { cwd: directory, env, stdin: "inherit", stdout: "inherit", stderr: "inherit" },
);
process.exitCode = await child.exited;
