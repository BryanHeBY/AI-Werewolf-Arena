/**
 * 单元测试：验证预言家公开深只读契约与 live 引用身份。合法形状的 result／history／安装返回写操作仅作编译反例，不执行；字面运行预期证明安装槽不冻结，唯具体 owner 命令写入。不运行 World 阶段、传输、对局或历史 fixture。
 */
import type { SeerReadState } from "@ai-werewolf-arena/game-contract";

import { expect, test } from "bun:test";
import { Camp, Role } from "@ai-werewolf-arena/game-contract";
import { createRoleComponent } from "../../../../src/game/observation/role-presentation";
import { getSeerState as publicRead } from "../../../../src/game/mechanisms/roles/seer/ports";
import {
  getSeerState,
  setSeerState,
  recordSeerInspection,
} from "../../../../src/game/mechanisms/roles/seer/ports";

function rejectedWrites(state: SeerReadState): void {
  // @ts-expect-error A read view grants no scalar write.
  state.lastTarget = 5;
  // @ts-expect-error A read view grants no history append.
  state.history.push({ targetId: 5, isWerewolf: true });
  // @ts-expect-error History row fields remain readonly.
  state.history[0]!.targetId = 5;
  // @ts-expect-error Last result fields remain readonly.
  state.lastResult!.kind = "camp";
  // @ts-expect-error Nested history results remain readonly.
  state.history[0]!.result!.kind = "camp";
}
void rejectedWrites;

test("public Seer reads and owner writes keep one unfrozen ability slot", () => {
  const role = createRoleComponent(Role.Seer, Camp.Good);
  const installed = setSeerState(role, { lastTarget: null, lastIsWerewolf: null, history: [] });
  expect(publicRead).toBe(getSeerState);
  expect(publicRead(role)).toBe(installed);
  expect(Object.isFrozen(installed)).toBe(false);
  recordSeerInspection(installed, 7, true, { kind: "camp", camp: "wolf" });
  expect(publicRead(role)).toBe(installed);
  expect(installed).toEqual({
    lastTarget: 7,
    lastIsWerewolf: true,
    lastResult: { kind: "camp", camp: "wolf" },
    history: [{ targetId: 7, isWerewolf: true, result: { kind: "camp", camp: "wolf" } }],
  });
});
