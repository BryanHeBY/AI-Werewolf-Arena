/**
 * 入口集成测试从仓库、应用和仓库外目录启动真实 Vite，独立预期核对同一应用资源与显式输入文件。
 * 仅使用带空格的临时归档和 loopback HTTP，不读取个人配置、不启动游戏或浏览器；退出关闭本次子进程。
 */
import { expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import {
  applicationDirectory,
  applicationResource,
  PROJECT_ROOT,
} from "@ai-werewolf-arena/project-paths";

async function withServer(cwd: string, verify: (url: URL) => Promise<void>) {
  const child = Bun.spawn(
    [
      process.execPath,
      applicationResource("replay", "scripts/dev.ts"),
      "--host",
      "127.0.0.1",
      "--port",
      "0",
      "--strictPort",
    ],
    {
      cwd,
      env: { ...process.env, NO_COLOR: "1" },
      stdin: "ignore",
      stdout: "pipe",
      stderr: "pipe",
    },
  );
  let timer: ReturnType<typeof setTimeout> | undefined;
  const stderr = new Response(child.stderr).text();
  try {
    const ready = (async () => {
      let text = "";
      for await (const chunk of child.stdout) {
        text += new TextDecoder().decode(chunk);
        const match = /http:\/\/127\.0\.0\.1:\d+\//.exec(text);
        if (match) return new URL(match[0]);
      }
      throw new Error(`replay_server_exited: ${await stderr}`);
    })();
    const url = await Promise.race([
      ready,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error("replay_server_start_timeout")), 10_000);
      }),
    ]);
    await verify(url);
  } finally {
    if (timer) clearTimeout(timer);
    child.kill("SIGTERM");
    await child.exited;
    await stderr;
  }
}

test("independent frontend keeps its application root from repository, application and external directories", async () => {
  const external = await mkdtemp(path.join(os.tmpdir(), "awa external replay "));
  try {
    for (const cwd of [PROJECT_ROOT, applicationDirectory("replay"), external]) {
      await withServer(cwd, async (url) => {
        const page = await fetch(url);
        expect(page.status).toBe(200);
        expect(await page.text()).toContain("/src/main.tsx");
        const entry = await fetch(new URL("src/main.tsx", url));
        expect(entry.status).toBe(200);
        expect(await entry.text()).toContain("createRoot");
      });
    }
  } finally {
    await rm(external, { recursive: true, force: true });
  }
}, 30_000);
