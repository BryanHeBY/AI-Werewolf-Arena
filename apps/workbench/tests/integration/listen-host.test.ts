/**
 * 负责验证监听主机、Host 白名单与同源写入的协作；输入隔离目录和显式主机，输出 HTTP 状态与真实入口地址。
 * 预期采用字面状态码、健康响应与主机地址，不调用生产白名单函数生成断言。
 * 不访问个人配置或调用模型；通配监听只在本测试生命周期内开放，结束回收服务、子进程及临时根。
 */
import { expect, test } from "bun:test";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createWorkbench } from "../../src/server/api";
import { eventually } from "../support/offline-workspace";

test("configured request hosts work while unrelated hosts and cross-origin writes remain rejected", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "awa-workbench-host-policy-"));
  try {
    const options = {
      repository: path.resolve(import.meta.dir, "../../../.."),
      configs: path.join(root, "configs"),
      records: path.join(root, "record"),
      jobs: path.join(root, "jobs"),
    };
    const local = createWorkbench(options);
    const lan = createWorkbench({ ...options, host: "192.0.2.40" });
    const ipv6 = createWorkbench({ ...options, host: "::1" });
    expect((await local.fetch(new Request("http://192.0.2.40:4310/api/health"))).status).toBe(403);
    expect((await lan.fetch(new Request("http://192.0.2.40:4310/api/health"))).status).toBe(200);
    expect((await lan.fetch(new Request("http://unrelated.invalid:4310/api/health"))).status).toBe(
      403,
    );
    expect((await ipv6.fetch(new Request("http://[::1]:4310/api/health"))).status).toBe(200);
    const write = (origin: string) =>
      lan.fetch(
        new Request("http://192.0.2.40:4310/api/validate", {
          method: "POST",
          headers: { "content-type": "application/json", origin },
          body: JSON.stringify({ kind: "boards", name: "one", text: "{}" }),
        }),
      );
    expect((await write("https://unrelated.invalid")).status).toBe(403);
    expect((await write("http://192.0.2.40:4310")).status).toBe(200);
    expect(await fs.readdir(root)).toEqual([]);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test("the real CLI binds the requested host and reports the system-selected port", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "awa-workbench-host-cli-"));
  const log = path.join(root, "service.log");
  const output = await fs.open(log, "w", 0o600);
  const child = Bun.spawn(
    [
      process.execPath,
      "--no-env-file",
      path.resolve(import.meta.dir, "../../src/server/main.ts"),
      "--host",
      "0.0.0.0",
      "--port",
      "0",
      "--configs-dir",
      path.join(root, "configs"),
      "--record-root-dir",
      path.join(root, "record"),
      "--state-dir",
      path.join(root, "state"),
    ],
    { stdin: "ignore", stdout: output.fd, stderr: output.fd },
  );
  await output.close();
  const timer = setTimeout(() => child.kill("SIGKILL"), 12000);
  try {
    const address = await eventually(
      async () => {
        const text = await fs.readFile(log, "utf8");
        if (child.exitCode !== null) throw Error(`test_workbench_listen_failed:${text}`);
        return text.match(/AWA Workbench (http:\/\/0\.0\.0\.0:\d+)/)?.[1];
      },
      (value) => typeof value === "string",
      8000,
    );
    const url = new URL(address!);
    expect(Number(url.port)).toBeGreaterThan(0);
    const local = await fetch(`http://127.0.0.1:${url.port}/api/health`);
    expect(local.status).toBe(200);
    expect(await local.json()).toEqual({ status: "ok" });
    const lanAddress = Object.values(os.networkInterfaces())
      .flat()
      .find((entry) => entry?.family === "IPv4" && !entry.internal)?.address;
    if (lanAddress)
      expect((await fetch(`http://${lanAddress}:${url.port}/api/health`)).status).toBe(200);
  } finally {
    if (child.exitCode === null) child.kill("SIGTERM");
    await child.exited;
    clearTimeout(timer);
    await fs.rm(root, { recursive: true, force: true });
  }
}, 15000);
