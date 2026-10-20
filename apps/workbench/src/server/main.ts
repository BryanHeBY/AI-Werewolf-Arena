/**
 * 负责本地工作台服务入口；输入显式配置／记录目录、主机和端口，输出 HTTP 服务及实际访问地址。
 * 默认绑定 loopback，网络绑定须显式指定；不删除本地内容，退出只关闭服务，不杀公共 CLI 管理的对局。
 */
import path from "node:path";
import {
  PROJECT_ROOT,
  applicationResource,
  projectDataPath,
  resolveInputPath,
} from "@ai-werewolf-arena/project-paths";
import { isLocale } from "@ai-werewolf-arena/game-contract";
import { workbenchText } from "@ai-werewolf-arena/game-text/workbench";
import { createWorkbench } from "./api";
import { normalizeListenHost, listenUrl } from "./listen-address";
const repository = PROJECT_ROOT;
const flags: Record<string, string> = {};
const args = process.argv.slice(2);
if (args[0] === "--") args.shift();
for (let i = 0; i < args.length; i += 2) {
  if (
    ![
      "--configs-dir",
      "--record-root-dir",
      "--host",
      "--port",
      "--state-dir",
      "--display-locale",
    ].includes(args[i]) ||
    !args[i + 1]
  )
    throw Error("workbench_usage");
  flags[args[i]] = args[i + 1];
}
const port = Number(flags["--port"] ?? 4310);
const host = normalizeListenHost(flags["--host"] ?? "127.0.0.1");
if (!Number.isSafeInteger(port) || port < 0 || port > 65535) throw Error("workbench_port_invalid");
const locale = flags["--display-locale"] ?? "zh-CN";
if (!isLocale(locale)) throw Error("workbench_locale_invalid");
const application = createWorkbench({
  host,
  repository,
  configs: resolveInputPath(flags["--configs-dir"] ?? projectDataPath("configs")),
  records: resolveInputPath(flags["--record-root-dir"] ?? projectDataPath("record")),
  jobs: path.resolve(flags["--state-dir"] ?? projectDataPath(".workbench"), "runs"),
  dist: applicationResource("workbench", "dist"),
});
let server: ReturnType<typeof Bun.serve>;
try {
  server = Bun.serve({
    hostname: host,
    port,
    maxRequestBodySize: 2_000_000,
    fetch: (request) => application.fetch(request),
  });
} catch (error) {
  // 端口冲突发生在服务建立之前，没有待关闭的对局；保留占用者，明确给出可执行的替代命令。
  if ((error as NodeJS.ErrnoException)?.code === "EADDRINUSE") {
    console.error(
      `[workbench] ${workbenchText(locale, "listenPortInUse")}: ${listenUrl(host, port)}`,
    );
    console.error(workbenchText(locale, "listenPortHelp"));
    console.error(`bun run workbench -- --port 0${host === "127.0.0.1" ? "" : ` --host ${host}`}`);
    process.exit(1);
  }
  throw error;
}
console.log(`AWA Workbench ${listenUrl(host, server.port!)}`);
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.on(signal, () => {
    void server.stop(true);
  });
