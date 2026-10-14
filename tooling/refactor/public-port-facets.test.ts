/**
 * 单元架构测试验证机制根的具名公开端口与私有实现仍有明确边界。
 * 输入为独立手写 feature、engine、adapter 和 gateway 依赖图；输出用字面违规类型验收。
 * 不执行机制或用生产结果生成预期；嵌套、下划线、近似名字和浏览器服务端限制不能借端口豁免。
 */
import { expect, test } from "bun:test";
import { checkDependencies } from "./architecture/dependency-check";
import { compiler, digest } from "./architecture/contracts";
const ts = compiler(process.cwd());
function rules(rows: Record<string, string>) {
  return checkDependencies(ts, {
    files: Object.entries(rows).map(([path,text])=>({path,text,sha256:digest(text)})),
    documentationPaths: [],
  }).map(r=>r.rule);
}

test("named root port facets are actual public endpoints for all server consumers", () => {
  expect(rules({
    "backend/src/game/mechanisms/roles/a/profile.ts": "import {x} from '../b/ability-ports';",
    "backend/src/game/engine/setup.ts": "import {x} from '../mechanisms/roles/b/setup-ports';",
    "backend/src/ai/agents/player/capture.ts": "import {x} from '../../../game/mechanisms/roles/b/player-ports';",
    "backend/src/game/gateway/preflight.ts": "type T=import('../mechanisms/roles/b/action-ports').T;",
    "backend/src/game/mechanisms/roles/b/ability-ports.ts": "export const x=1;",
    "backend/src/game/mechanisms/roles/b/setup-ports.ts": "export const x=1;",
    "backend/src/game/mechanisms/roles/b/player-ports.ts": "export const x=1;",
    "backend/src/game/mechanisms/roles/b/action-ports.ts": "export interface T {}",
  })).toEqual([]);
});

test("private nested and similarly named files stay private for feature and engine", () => {
  for (const leaf of ["internal/setup-ports", "setup_ports", "ports-setup", "ability-assembly", "private/index"]) {
    expect(rules({
      "backend/src/game/mechanisms/roles/a/profile.ts": `import {x} from '../b/${leaf}';`,
      "backend/src/game/engine/setup.ts": `import {x} from '../mechanisms/roles/b/${leaf}';`,
      [`backend/src/game/mechanisms/roles/b/${leaf}.ts`]: "export const x=1;",
    })).toEqual(["dependency.feature-internal", "dependency.engine-feature"]);
  }
});

test("public port naming does not waive the domain and browser dependency boundaries", () => {
  const rows = rules({
    "backend/src/core/domain/input.ts": "import {x} from '../../game/mechanisms/roles/b/setup-ports';",
    "frontend/src/input.ts": "import {x} from '../../backend/src/game/mechanisms/roles/b/setup-ports';",
    "backend/src/game/mechanisms/roles/b/setup-ports.ts": "export const x=1;",
  });
  expect(rows).toContain("dependency.domain-implementation");
  expect(rows).toContain("dependency.frontend-backend");
});
