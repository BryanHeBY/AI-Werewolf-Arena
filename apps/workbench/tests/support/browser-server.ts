/** 负责浏览器场景的合成服务生命周期；输入独立测试工作区，输出本机端口。退出先停止测试对局，再关闭服务并清理该临时根。 */
import { offlineWorkspace } from "./offline-workspace";
const workspace = await offlineWorkspace();
const server = Bun.serve({
  hostname: "127.0.0.1",
  port: 4319,
  fetch: (request) => workspace.application.fetch(request),
});
const shutdown = async () => {
  for (const run of await workspace.application.sessions.list())
    if (run.canStop) {
      try {
        await workspace.application.sessions.stop(run.sessionId);
      } catch {}
    }
  await server.stop(true);
  await workspace.close();
  process.exit(0);
};
for (const signal of ["SIGINT", "SIGTERM"] as const) process.on(signal, () => void shutdown());
console.log(`Offline workbench ${server.url}`);
