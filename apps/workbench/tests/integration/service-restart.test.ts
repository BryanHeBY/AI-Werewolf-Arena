/**
 * 集成测试负责验证真实工作台服务与对局 CLI 的进程所有权；输入独立临时根和本机合成模型。
 * 明确退出并重启生产 HTTP 入口，独立断言同一局仍继续请求模型且可重新发现、停止与发布录制。
 * 不使用浏览器夹具的关停钩子，不接触用户 configs／record／output 或任何计费模型。
 */
import { expect, test } from "bun:test";
import { promises as fs } from "node:fs";
import path from "node:path";
import type { SessionEntry } from "@ai-werewolf-arena/workbench-contract";
import { readProcessIdentity } from "@ai-werewolf-arena/game-runtime/run-session";
import { offlineWorkspace, eventually } from "../support/offline-workspace";

type Workspace = Awaited<ReturnType<typeof offlineWorkspace>>;

async function productionService(workspace: Workspace, ordinal: number) {
  const log = path.join(workspace.root, `http-${ordinal}.log`);
  const output = await fs.open(log, "w", 0o600);
  const child = Bun.spawn(
    [
      process.execPath,
      path.join(workspace.repository, "apps/workbench/src/server/main.ts"),
      "--configs-dir",
      workspace.configs,
      "--record-root-dir",
      workspace.records,
      "--state-dir",
      path.join(workspace.root, "workbench-state"),
      "--port",
      "0",
    ],
    {
      cwd: workspace.repository,
      stdin: "ignore",
      stdout: output.fd,
      stderr: output.fd,
    },
  );
  await output.close();
  async function close() {
    if (child.exitCode !== null) return;
    child.kill("SIGTERM");
    try {
      await eventually(
        async () => child.exitCode,
        (code) => code !== null,
        10000,
      );
    } finally {
      if (child.exitCode === null) child.kill("SIGKILL");
      await child.exited;
    }
  }
  try {
    const url = await eventually(
      async () => {
        const text = await fs.readFile(log, "utf8");
        if (child.exitCode !== null) throw Error(`workbench_service_exited:${text}`);
        return text.match(/AWA Workbench (http:\/\/127\.0\.0\.1:\d+)/)?.[1];
      },
      (value) => typeof value === "string",
      15000,
    );
    expect((await fetch(`${url}/api/health`)).status).toBe(200);
    return { url: url!, child, close };
  } catch (error) {
    await close();
    throw error;
  }
}

test("closing and restarting the production HTTP service preserves and rediscovers its independent CLI", async () => {
  const workspace = await offlineWorkspace();
  workspace.slow();
  const gameFile = path.join(workspace.configs, "games/offline_game.json");
  const game = JSON.parse(await fs.readFile(gameFile, "utf8"));
  await fs.writeFile(gameFile, JSON.stringify({ ...game, maxRuntimeMs: 30000 }));
  const servers: Awaited<ReturnType<typeof productionService>>[] = [];
  let id: string | undefined;
  let runtime: { pid: number; processStart: string } | undefined;
  let primaryFailure: unknown;
  let failed = false;
  try {
    const original = await productionService(workspace, 1);
    servers.push(original);
    const start = await fetch(`${original.url}/api/runs`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: original.url },
      body: JSON.stringify({ gameName: "offline_game" }),
    });
    expect(start.status).toBe(200);
    id = ((await start.json()) as { sessionId: string }).sessionId;
    await eventually(
      () => workspace.application.sessions.get(id!),
      (entry) => !!entry?.canStop,
    );
    await eventually(
      async () => workspace.requestCount(),
      (count) => count > 0,
    );
    runtime = JSON.parse(
      await fs.readFile(path.join(workspace.records, id!, "runtime.json"), "utf8"),
    );

    // 退出的是生产服务本身；随后出现新的模型请求，证明原 CLI 没随父服务一起退出。
    await original.close();
    const before = workspace.requestCount();
    await eventually(
      async () => workspace.requestCount(),
      (count) => count > before,
    );
    expect(await readProcessIdentity(runtime!.pid)).toBe(runtime!.processStart);

    const restarted = await productionService(workspace, 2);
    servers.push(restarted);
    const listing = (await (await fetch(`${restarted.url}/api/runs`)).json()) as SessionEntry[];
    expect(listing.find((entry) => entry.sessionId === id)).toMatchObject({
      origin: "workbench",
      state: "running",
      canStop: true,
    });
    expect(JSON.stringify(listing)).not.toContain('"token"');
    const stop = await fetch(`${restarted.url}/api/runs/${id}/stop`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: restarted.url },
      body: "{}",
    });
    expect(stop.status).toBe(200);
    const ended = await eventually(
      () => workspace.application.sessions.get(id!),
      (entry) => entry?.state === "cancelled",
    );
    expect(ended).toMatchObject({
      recording: "complete",
      game: "unfinished",
      canStop: false,
      canReplay: true,
    });
    await eventually(
      () => readProcessIdentity(runtime!.pid),
      (identity) => identity !== runtime!.processStart,
    );
  } catch (error) {
    primaryFailure = error;
    failed = true;
  }
  const cleanupFailures: unknown[] = [];
  try {
    if (id) {
      // 断言可能早于正常读取 metadata 失败；仍从本测试创建的独立目录恢复清理身份。
      if (!runtime)
        try {
          runtime = JSON.parse(
            await fs.readFile(path.join(workspace.records, id, "runtime.json"), "utf8"),
          );
        } catch {}
      try {
        await workspace.application.sessions.stop(id);
      } catch {}
      if (runtime)
        try {
          await eventually(
            () => readProcessIdentity(runtime!.pid),
            (identity) => identity !== runtime!.processStart,
            10000,
          );
        } catch (error) {
          cleanupFailures.push(error);
          // 仅故障清理可强制终止本测试拥有的子进程；先核验启动身份，避免命中复用 PID。
          if ((await readProcessIdentity(runtime.pid)) === runtime.processStart)
            process.kill(runtime.pid, "SIGKILL");
          await eventually(
            () => readProcessIdentity(runtime!.pid),
            (identity) => identity !== runtime!.processStart,
            5000,
          );
        }
    }
  } catch (error) {
    cleanupFailures.push(error);
  }
  // 原始断言错误优先；每项清理独立等待，避免一个失败跳过其它服务、模型及临时根。
  const services = await Promise.allSettled(servers.map((service) => service.close()));
  cleanupFailures.push(
    ...services.flatMap((result) => (result.status === "rejected" ? [result.reason] : [])),
  );
  try {
    await workspace.close();
  } catch (error) {
    cleanupFailures.push(error);
  }
  if (failed) throw primaryFailure;
  if (cleanupFailures.length)
    throw new AggregateError(cleanupFailures, "offline_workbench_cleanup_failed");
}, 60000);
