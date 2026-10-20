/**
 * 负责验证工作台真实入口的端口冲突诊断；输入本测试占用的本机端口和独立临时根，输出双语提示与非零退出码。
 * 不终止占用者，不读取个人配置或启动模型；断言失败也会回收本测试的子进程与监听器。
 */
import { expect, test } from "bun:test";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

for (const locale of ["zh-CN", "en"] as const)
  test(`${locale}: occupied ports show an actionable message and preserve the existing listener`, async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "awa-workbench-port-conflict-"));
    const listener = Bun.serve({
      hostname: "127.0.0.1",
      port: 0,
      fetch: () => new Response("original listener"),
    });
    const child = Bun.spawn(
      [
        process.execPath,
        "--no-env-file",
        path.resolve(import.meta.dir, "../../src/server/main.ts"),
        "--port",
        String(listener.port),
        "--display-locale",
        locale,
        "--configs-dir",
        path.join(root, "configs"),
        "--record-root-dir",
        path.join(root, "record"),
        "--state-dir",
        path.join(root, "state"),
      ],
      { stdin: "ignore", stdout: "pipe", stderr: "pipe" },
    );
    const timer = setTimeout(() => child.kill(), 8000);
    try {
      const [code, stderr, stdout] = await Promise.all([
        child.exited,
        new Response(child.stderr).text(),
        new Response(child.stdout).text(),
      ]);
      expect(code).toBe(1);
      expect(stdout).toBe("");
      expect(stderr).toContain(
        locale === "en" ? "The workbench port is already in use" : "工作台监听端口已被占用",
      );
      expect(stderr).toContain(`http://127.0.0.1:${listener.port}`);
      expect(stderr).toContain("bun run workbench -- --port 0");
      expect(stderr).not.toContain("at /home/");
      expect(await (await fetch(`http://127.0.0.1:${listener.port}`)).text()).toBe(
        "original listener",
      );
      expect(await fs.readdir(root)).toEqual([]);
    } finally {
      clearTimeout(timer);
      if (child.exitCode === null) child.kill();
      await child.exited;
      await listener.stop(true);
      await fs.rm(root, { recursive: true, force: true });
    }
  }, 15000);
