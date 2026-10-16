/**
 * 场景测试用公开示例板验证可选昵称能穿过真实装配，并保持机制原身份授权。
 * 只启动内存 World 和调用原 owner 查询；不运行模型、文件录制或完整对局。
 * 无昵称／有昵称和明确的身份篡改分别提供预期，不通过填充默认名规避初始化失败。
 */
import { expect, test } from "bun:test";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { loadBoardDefinition } from "../../../src/app/config/load-board-definition";
import { bootstrapGame } from "../../../src/app/bootstrap";
import { COMPONENT } from "../../../src/domain/components/names";
import type { World } from "../../../src/domain/world";
import { createRandom } from "../../../src/domain/random";
import { assertRadiantRosterCurrent } from "../../../src/features/radiant-eclipse/night-frame";
import { openEclipseSuppression } from "../../../src/features/radiant-eclipse/suppression";
import { findNightAbility } from "../../../src/features/night-abilities/abilities";
import { isMagicianBoard } from "../../../src/features/magician/night-frame";
import { assertTricksterRosterCurrent } from "../../../src/features/trickster/night-frame";
import { assertTimeConsortRosterCurrent } from "../../../src/features/time-wolf-consort/night-frame";
import { assertScholarMentorRosterCurrent } from "../../../src/features/scholar-mentor/night-frame";
import { assertWolfSorcererRosterCurrent } from "../../../src/features/wolf-sorcerer/night-frame";
import { assertMistRosterCurrent } from "../../../src/features/mist-raven/night-frame";
import { MistCasterAuthority } from "../../../src/features/mist-raven/caster-authority";
import { assertNobleBodyRosterCurrent } from "../../../src/features/noble-secret-body/authority";
import { fragrantAuthoritySnapshot } from "../../../src/features/fragrant-pair-seer/authority";
import { assertOrderPrinceOriginalCurrent } from "../../../src/features/order-prince/authority";

const configsDir = path.resolve(import.meta.dir, "../../../../configs.example");
const boardIds = (await readdir(path.join(configsDir, "boards")))
  .filter((file) => file.endsWith(".json"))
  .map((file) => file.slice(0, -5))
  .sort();

for (const boardId of boardIds) {
  test(`${boardId}：中英装配不要求昵称或补默认名字`, async () => {
    const board = await loadBoardDefinition(configsDir, boardId);
    for (const locale of ["zh-CN", "en"] as const) {
      const game = bootstrapGame(board.config, {
        locale,
        random: createRandom("optional-player-name-authorities"),
      });
      expect(game.playerIds).toHaveLength(board.config.boardSize);
      for (const id of game.playerIds) {
        expect(Object.hasOwn(game.world.getComponent(id, COMPONENT.Identity)!, "name")).toBe(false);
      }
    }
  });
}

const authorities: readonly [string, (world: World) => unknown][] = [
  ["awa_radiant_eclipse_12_v1", assertRadiantRosterCurrent],
  ["awa_magician_12_n1_original_v1", isMagicianBoard],
  ["awa_trickster_12_v1", assertTricksterRosterCurrent],
  ["awa_time_consort_12_v1", assertTimeConsortRosterCurrent],
  ["awa_scholar_mentor_12_v1", assertScholarMentorRosterCurrent],
  ["awa_wolf_sorcerer_12_v1", assertWolfSorcererRosterCurrent],
  ["awa_mist_raven_12_v1", assertMistRosterCurrent],
  ["awa_noble_secret_body_12_standard_repeat_v1", assertNobleBodyRosterCurrent],
  ["awa_fragrant_pair_seer_12_v1", fragrantAuthoritySnapshot],
  ["awa_order_prince_12_v1", assertOrderPrinceOriginalCurrent],
];

for (const [boardId, assertCurrent] of authorities) {
  test(`${boardId}：无昵称身份仍拒绝 getter、继承、后添字段和同值替换`, async () => {
    const board = await loadBoardDefinition(configsDir, boardId);
    let reads = 0;
    for (const mutation of [
      "accessor",
      "inherited",
      "undefined",
      "added",
      "replacement",
    ] as const) {
      const game = bootstrapGame(board.config, {
        random: createRandom("optional-name-revocation"),
      });
      // 定序王子只绑定自己的身份；其他 owner 固定本板完整原阵容。
      const id =
        boardId === "awa_order_prince_12_v1"
          ? game.playerIds.find(
              (id) => game.world.getComponent(id, COMPONENT.Role)?.role === "order_prince",
            )!
          : game.playerIds[0]!;
      const identity = game.world.getComponent(id, COMPONENT.Identity)!;
      expect(() => assertCurrent(game.world)).not.toThrow();
      const getter = () => {
        reads++;
        throw new Error("不得读取新装入的昵称 getter");
      };
      if (mutation === "accessor") Object.defineProperty(identity, "name", { get: getter });
      if (mutation === "inherited")
        Object.setPrototypeOf(identity, {
          get name() {
            return getter();
          },
        });
      if (mutation === "undefined") Object.defineProperty(identity, "name", { value: undefined });
      if (mutation === "added") identity.name = "中途取名";
      if (mutation === "replacement")
        game.world.addComponent(id, COMPONENT.Identity, { ...identity });
      expect(() => assertCurrent(game.world)).toThrow();
    }
    expect(reads).toBe(0);
  });

  test(`${boardId}：显式昵称原样保留，改成同值 getter 或删除仍撤权`, async () => {
    const board = await loadBoardDefinition(configsDir, boardId);
    const playerNames = Object.fromEntries(
      Array.from({ length: board.config.boardSize }, (_, i) => [String(i + 1), `玩家·${i + 1}`]),
    );
    let reads = 0;
    for (const mutation of ["accessor", "removed"] as const) {
      const game = bootstrapGame(board.config, {
        playerNames,
        random: createRandom("named-revocation"),
      });
      const id =
        boardId === "awa_order_prince_12_v1"
          ? game.playerIds.find(
              (id) => game.world.getComponent(id, COMPONENT.Role)?.role === "order_prince",
            )!
          : game.playerIds[0]!;
      const identity = game.world.getComponent(id, COMPONENT.Identity)!;
      expect(identity.name).toBe(`玩家·${identity.seat}`);
      expect(() => assertCurrent(game.world)).not.toThrow();
      const originalName = identity.name;
      if (mutation === "accessor")
        Object.defineProperty(identity, "name", {
          get() {
            reads++;
            return originalName;
          },
        });
      else delete identity.name;
      expect(() => assertCurrent(game.world)).toThrow();
    }
    expect(reads).toBe(0);
  });
}

test("雾鸦施法授权允许缺省昵称，并独立拒绝后来安装的昵称访问器", async () => {
  const board = await loadBoardDefinition(configsDir, "awa_mist_raven_12_v1");
  const game = bootstrapGame(board.config, { random: createRandom("unnamed-mist-caster") });
  const actorId = game.playerIds.find(
    (id) => game.world.getComponent(id, COMPONENT.Role)?.role === "alchemist",
  )!;
  const authority = new MistCasterAuthority(game.world, actorId, 1, "alchemist");
  expect(authority.isCurrent()).toBe(true);
  let reads = 0;
  Object.defineProperty(game.world.getComponent(actorId, COMPONENT.Identity)!, "name", {
    get() {
      reads++;
      throw new Error("不得读取施法者昵称 getter");
    },
  });
  expect(authority.isCurrent()).toBe(false);
  expect(reads).toBe(0);
});

test("蚀日原生抑制允许缺省昵称，昵称继承不能继续原实例授权", async () => {
  const board = await loadBoardDefinition(configsDir, "awa_radiant_eclipse_12_v1");
  const game = bootstrapGame(board.config, { random: createRandom("unnamed-eclipse-suppression") });
  const actorId = game.playerIds.find(
    (id) => game.world.getComponent(id, COMPONENT.Role)?.role === "witch",
  )!;
  const ability = findNightAbility(game.world.getComponent(actorId, COMPONENT.Role), "potion")!;
  const suppression = openEclipseSuppression(game.world, actorId, ability, 2);
  expect(suppression.isCurrent()).toBe(true);
  let reads = 0;
  Object.setPrototypeOf(game.world.getComponent(actorId, COMPONENT.Identity)!, {
    get name() {
      reads++;
      throw new Error("不得读取被抑制者的继承昵称");
    },
  });
  expect(suppression.isCurrent()).toBe(false);
  expect(reads).toBe(0);
});
