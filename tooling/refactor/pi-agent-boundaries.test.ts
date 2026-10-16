/**
 * 本单元架构测试负责验证新增 Pi 编排目录仍属于 Agent 执行层，不能借新路径绕过机制私有实现边界。
 * 输入为手写源码图，输出按字面的三种违规和公开端口零违规核对，不运行生产角色或模型。
 * 合成图只代表静态依赖政策；不代替 Pi 工具、取消或文件隔离的运行验收。
 */
import { expect, test } from "bun:test";
import { compiler, digest, type ArchitectureInput } from "./architecture/contracts";
import { checkDependencies } from "./architecture/dependency-check";

const ts = compiler(process.cwd());
function graph(rows: Record<string, string>): ArchitectureInput {
  return {
    files: Object.entries(rows).map(([path, text]) => ({ path, text, sha256: digest(text) })),
    documentationPaths: [],
  };
}

test("Pi execution rejects private feature imports, type imports and reexports", () => {
  const failures = checkDependencies(
    ts,
    graph({
      "backend/src/agents/pi/action-provider.ts":
        "import { x } from '../../features/test-role/authority';",
      "backend/src/agents/pi/session.ts": "export { x } from '../../features/test-role/authority';",
      "backend/src/agents/pi/contracts.ts":
        "export type State = import('../../features/test-role/state').State;",
      "backend/src/features/test-role/authority.ts": "export const x = 1;",
      "backend/src/features/test-role/state.ts": "export interface State { count: number; }",
    }),
  );
  expect(failures.map(({ rule }) => rule)).toEqual([
    "dependency.adapter-feature",
    "dependency.adapter-feature",
    "dependency.adapter-feature",
  ]);
  expect(failures.map(({ path }) => path)).toEqual([
    "backend/src/agents/pi/action-provider.ts",
    "backend/src/agents/pi/session.ts",
    "backend/src/agents/pi/contracts.ts",
  ]);
});

test("Pi execution consumes explicit feature contracts and ports without broadening public APIs", () => {
  const failures = checkDependencies(
    ts,
    graph({
      "backend/src/agents/pi/action-provider.ts":
        "import { x } from '../../features/test-role/ports'; import type { State } from '../../features/test-role/contracts';",
      "backend/src/features/test-role/ports.ts": "export const x = 1;",
      "backend/src/features/test-role/contracts.ts": "export interface State { count: number; }",
    }),
  );
  expect(failures).toEqual([]);
});
