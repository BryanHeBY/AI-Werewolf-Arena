/**
 * 集成测试负责公开bwrap入口的真实文件／环境隔离与本机MCP网络边界，输入全为独立合成canary。
 * 原玩家目录可写，同行／God／宿主home／认证原路径不可读；仅显式auth映射只读，具名变量才可见。
 * 本探针不启动Codex/Claude、不读个人认证或调用模型；不把cwd或ACP工具许可冒称操作系统沙箱。
 */
import { expect, test } from "bun:test";
import { access, mkdir, realpath, symlink, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { bootstrapGame } from "../../../../src/app/bootstrap";
import { AcpTurnRegistry } from "../../../../src/adapters/acp/acp-turn-registry";
import { WerewolfMcpControlServer } from "../../../../src/adapters/acp/werewolf-mcp-control";
import { sixPlayerMvpConfig } from "../../../../src/rulesets/presets/six-player-mvp";
import { speakRequest } from "../../../support/builders/agents/acp-requests";
import { createTestTempDirectory } from "../../../support/drivers/temp-directories";
const launcher = fileURLToPath(
  new URL("../../../../../configs.example/acp/run-bwrap-acp.sh", import.meta.url),
);
test("隔离入口拒认证目录、根目录别名与过宽cwd，拒绝发生在bwrap执行前", async () => {
  const root = await createTestTempDirectory("awa-acp-sandbox-input-"),
    alias = path.join(root, "root-alias");
  await symlink("/", alias);
  const run = (env: Record<string, string>, cwd = root) =>
    spawnSync("/bin/bash", [launcher, "/bin/true"], {
      cwd,
      env: { PATH: "/usr/bin:/bin", BWRAP_BIN: "/bin/true", ...env },
      encoding: "utf8",
    }).status;
  expect(run({ ACP_AUTH_SOURCE: root })).toBe(66);
  expect(run({ ACP_READONLY_ROOTS: "/tmp/.." })).toBe(64);
  expect(run({ ACP_READONLY_ROOTS: alias })).toBe(64);
  expect(run({ ACP_READONLY_ROOTS: "//" })).toBe(64);
  expect(run({}, "/")).toBe(64);
});
for (const kind of ["codex", "claude"] as const)
  test.skipIf(process.platform !== "linux" || !existsSync("/usr/bin/bwrap"))(
    `公开隔离入口真实canary/${kind}`,
    async () => {
      const root = await createTestTempDirectory("awa-acp-sandbox-canary-"),
        own = path.join(root, "player-1"),
        peer = path.join(root, "player-2"),
        hostHome = path.join(root, "host-home"),
        auth = path.join(hostHome, "synthetic-auth.json"),
        god = path.join(root, "god-record.json"),
        binary = await realpath(process.execPath),
        endpoint = Bun.serve({
          hostname: "127.0.0.1",
          port: 0,
          fetch: () => Response.json({ synthetic: true }),
        });
      try {
        for (const directory of [own, peer, hostHome]) await mkdir(directory);
        for (const file of [
          path.join(peer, "private.txt"),
          path.join(hostHome, "private.txt"),
          auth,
          god,
        ])
          await writeFile(file, "synthetic-canary-no-personal-data");
        const mapped =
            kind === "codex" ? "/opt/codex-home/auth.json" : "/opt/claude-home/.credentials.json",
          worker = path.join(own, "canary.ts");
        await writeFile(
          worker,
          `
import {readFile,writeFile} from 'node:fs/promises';
const paths=${JSON.stringify([path.join(peer, "private.txt"), path.join(hostHome, "private.txt"), auth, god])};
const readable=await Promise.all(paths.map(p=>readFile(p).then(()=>true,()=>false)));
const authReadable=await readFile(${JSON.stringify(mapped)},'utf8').then(v=>v==='synthetic-canary-no-personal-data');
const authWritable=await writeFile(${JSON.stringify(mapped)},'changed').then(()=>true,()=>false);
await writeFile('own-output.txt','own-write');
await writeFile(process.env.HOME+'/private-state.txt','ephemeral');
const network=await fetch(process.env.AWA_CANARY_ENDPOINT).then(r=>r.json());
process.stdout.write(JSON.stringify({readable,authReadable,authWritable,allowed:process.env.AWA_ALLOWED,secret:process.env.AWA_HOST_SECRET??null,home:process.env.HOME,network}));
`,
        );
        const child = spawn("/bin/bash", [launcher, binary, worker], {
          cwd: own,
          env: {
            PATH: "/usr/bin:/bin",
            HOME: hostHome,
            ACP_AUTH_SOURCE: auth,
            ACP_AUTH_KIND: kind,
            ACP_MCP_RUNTIME_EXECUTABLE: binary,
            ACP_ENV_ALLOWLIST: "AWA_ALLOWED:AWA_CANARY_ENDPOINT",
            AWA_ALLOWED: "explicit-canary",
            AWA_CANARY_ENDPOINT: endpoint.url.href,
            AWA_HOST_SECRET: "must-not-inherit",
          },
          stdio: ["ignore", "pipe", "pipe"],
        });
        let stdout = "",
          stderr = "";
        child.stdout!.setEncoding("utf8").on("data", (chunk) => {
          stdout += chunk;
        });
        child.stderr!.setEncoding("utf8").on("data", (chunk) => {
          stderr += chunk;
        });
        const code = await new Promise<number | null>((resolve, reject) => {
          child.once("error", reject);
          child.once("exit", resolve);
        });
        expect(code, stderr).toBe(0);
        expect(JSON.parse(stdout)).toEqual({
          readable: [false, false, false, false],
          authReadable: true,
          authWritable: false,
          allowed: "explicit-canary",
          secret: null,
          home: "/tmp/home",
          network: { synthetic: true },
        });
        await access(path.join(own, "own-output.txt"));
      } finally {
        endpoint.stop(true);
      }
    },
    15000,
  );

test.skipIf(process.platform !== "linux" || !existsSync("/usr/bin/bwrap"))(
  "隔离内真实MCP依赖发现与行动提交",
  async () => {
    const repository = fileURLToPath(new URL("../../../../../", import.meta.url)),
      workspace = await createTestTempDirectory("awa-acp-isolated-mcp-"),
      binary = await realpath(process.execPath),
      registry = new AcpTurnRegistry(bootstrapGame(sixPlayerMvpConfig).world),
      control = new WerewolfMcpControlServer(registry),
      config = await control.start(binary, []),
      env = Object.fromEntries(config.env.map((entry) => [entry.name, entry.value])),
      client = new Client({ name: "awa-isolated-canary", version: "1.0.0" });
    control.bindSession("isolated-canary");
    const pending = registry.openTurn(speakRequest(), "isolated-canary"),
      transport = new StdioClientTransport({
        command: "/bin/bash",
        args: [
          launcher,
          binary,
          path.join(repository, "backend/src/adapters/acp/werewolf-mcp-server.ts"),
        ],
        cwd: workspace,
        env: {
          ...env,
          PATH: "/usr/bin:/bin",
          ACP_MCP_RUNTIME_EXECUTABLE: binary,
          ACP_READONLY_ROOTS: ["backend/src", "backend/node_modules", "node_modules", "packages"]
            .map((name) => path.join(repository, name))
            .join(":"),
          ACP_ENV_ALLOWLIST: "WEREWOLF_MCP_CONTROL_URL:WEREWOLF_MCP_TOKEN",
        },
      });
    try {
      await client.connect(transport);
      expect((await client.listTools()).tools.map((tool) => tool.name).sort()).toEqual([
        "get_game_schema",
        "report_bug",
        "submit_action",
      ]);
      expect(await client.callTool({ name: "get_game_schema", arguments: {} })).toMatchObject({
        structuredContent: { protocol_version: "1" },
      });
      expect(
        await client.callTool({
          name: "submit_action",
          arguments: {
            turn_id: pending.turnId,
            action: "speak",
            arguments: { text: "Isolated synthetic action." },
          },
        }),
      ).toMatchObject({ structuredContent: { ok: true, accepted: true } });
      expect(await pending.action).toEqual({
        name: "speak",
        args: { text: "Isolated synthetic action." },
      });
    } finally {
      await client.close();
      registry.close();
      await control.close({ force: true });
    }
  },
  15000,
);
