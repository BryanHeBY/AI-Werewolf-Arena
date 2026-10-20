/**
 * 负责本地工作台服务入口；输入显式配置／记录目录和端口，输出本机 HTTP 服务。
 * 只绑定 loopback，不删除本地内容；退出只关闭服务，不杀已交公共 CLI 管理的对局。
 */
import path from "node:path";
import { createWorkbench } from "./api";
const repository = path.resolve(import.meta.dir, "../../../..");
const flags: Record<string, string> = {};
const args = process.argv.slice(2);
if (args[0] === "--") args.shift();
for (let i = 0; i < args.length; i += 2) {
  if (
    !["--configs-dir", "--record-root-dir", "--port", "--state-dir"].includes(args[i]) ||
    !args[i + 1]
  )
    throw Error("workbench_usage");
  flags[args[i]] = args[i + 1];
}
const port = Number(flags["--port"] ?? 4310);
if (!Number.isSafeInteger(port) || port < 0 || port > 65535) throw Error("workbench_port_invalid");
const application = createWorkbench({
  repository,
  configs: path.resolve(flags["--configs-dir"] ?? path.join(repository, "configs")),
  records: path.resolve(flags["--record-root-dir"] ?? path.join(repository, "record")),
  jobs: path.resolve(flags["--state-dir"] ?? path.join(repository, ".workbench"), "runs"),
  dist: path.resolve(import.meta.dir, "../../dist"),
});
const server = Bun.serve({
  hostname: "127.0.0.1",
  port,
  maxRequestBodySize: 2_000_000,
  fetch: (request) => application.fetch(request),
});
console.log(`AWA Workbench http://127.0.0.1:${server.port}`);
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.on(signal, () => {
    void server.stop(true);
  });
