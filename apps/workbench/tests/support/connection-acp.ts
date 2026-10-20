/** 负责连接探测测试专用的合成 ACP 进程；只处理 stdio 协议并记录独立断言所需的 PID 与 MCP 样本，不连接模型或执行文件工具。 */
import { createInterface } from "node:readline";
import { writeFile } from "node:fs/promises";
const send = (value: unknown) => process.stdout.write(JSON.stringify(value) + "\n");
for await (const line of createInterface({ input: process.stdin })) {
  const rpc = JSON.parse(line);
  if (rpc.id === undefined) continue;
  if (rpc.method === "initialize") {
    await writeFile("connection-facts.json", JSON.stringify({ pid: process.pid }));
    if (process.env.AWA_TEST_PROBE_HANG === "1") continue;
    send({ jsonrpc: "2.0", id: rpc.id, result: { protocolVersion: 1, agentCapabilities: {} } });
  } else if (rpc.method === "session/new") {
    await writeFile(
      "connection-facts.json",
      JSON.stringify({ pid: process.pid, mcpServers: rpc.params.mcpServers }),
    );
    send({ jsonrpc: "2.0", id: rpc.id, result: { sessionId: "connection-test" } });
  } else if (rpc.method === "session/prompt") {
    send({
      jsonrpc: "2.0",
      method: "session/update",
      params: {
        sessionId: "connection-test",
        update: { sessionUpdate: "agent_message_chunk", content: { type: "text", text: "OK" } },
      },
    });
    send({ jsonrpc: "2.0", id: rpc.id, result: { stopReason: "end_turn" } });
  }
}
