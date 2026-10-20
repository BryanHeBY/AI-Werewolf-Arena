/**
 * 单元测试以固定原生玩家及委托 runtime 端口为输入，核对 Animal Dream 具体夜 acquisition 和终态关闭。字面访问顺序、authority 状态、资源不变及原错误为预期；仅执行一个有界夜，不运行传输或整局。Cat／Puffer 死亡及实际放逐单元不在本生命周期测试范围。
 */
import { expect, test } from "bun:test";
import type { GameEvent } from "@ai-werewolf-arena/game-contract";
import { animalGame } from "../../../support/features/animal-dream/builders/runtime-game";
import {
  AnimalNightUnit,
  animalAuthoritySnapshot,
} from "../../../../src/features/animal-dream/ports";
function fixture(sealed = false) {
  const game = animalGame("en"),
    events: GameEvent[] = [],
    accesses: string[] = [];
  if (sealed) Object.seal(events);
  const unit = new AnimalNightUnit(
    {
      get world() {
        accesses.push("world");
        return game.world;
      },
      get events() {
        accesses.push("events");
        return events;
      },
    },
    1,
  );
  return { game, unit, events, accesses };
}

test("inert construction and normal close preserve authority-before-fact reads and skip finally abort", () => {
  const f = fixture();
  expect(f.accesses).toEqual([]);
  const current = () => {
    f.accesses.push("current");
    return true;
  };
  f.unit.open(current);
  expect(f.accesses).toEqual(["world", "current", "world", "events"]);
  expect(f.events.map((event) => event.type)).toEqual(["animal_night_opened"]);
  f.unit.closeNormally();
  const afterClose = [...f.accesses];
  f.unit.abortIfOwned();
  expect(f.accesses).toEqual(afterClose);
  expect(animalAuthoritySnapshot(f.game.world)?.night).toEqual({
    day: 1,
    status: "normal",
    requiresFox: false,
    foxPaid: false,
  });
  expect(() => f.unit.closeNormally()).toThrow("animal_night_not_complete");
  expect(animalAuthoritySnapshot(f.game.world)?.stopped).toBe(false);
});

test("fact publication rejection aborts the acquired night without spending Fox or creating death units", () => {
  const f = fixture(true);
  let caught: unknown;
  try {
    f.unit.open(() => true);
  } catch (error) {
    caught = error;
  } finally {
    f.unit.abortIfOwned();
  }
  expect(caught).toBeInstanceOf(Error);
  expect((caught as Error).message).toBe("animal_fact_log_invalid");
  expect(f.accesses).toEqual(["world", "world", "events", "world"]);
  expect(f.events).toEqual([]);
  const snapshot = animalAuthoritySnapshot(f.game.world, false)!;
  expect(snapshot.stopped).toBe(true);
  expect(snapshot.night).toEqual({ day: 1, status: "aborted", requiresFox: false, foxPaid: false });
  expect(snapshot.fox).toEqual({ policy: "awa_animal_dream_v1", usedNight: null, history: [] });
  expect(snapshot.completedUnits).toBe(0);
  expect(snapshot.unit).toBe(null);
});

test("failed opening keeps the original authority stop and does not claim pipeline acquisition", () => {
  const f = fixture(),
    failure = new Error("animal_current_rejected");
  let caught: unknown;
  try {
    f.unit.open(() => {
      throw failure;
    });
  } catch (error) {
    caught = error;
  } finally {
    f.unit.abortIfOwned();
  }
  expect(caught).toBe(failure);
  expect(f.accesses).toEqual(["world"]);
  expect(f.events).toEqual([]);
  expect(animalAuthoritySnapshot(f.game.world, false)?.stopped).toBe(true);
  expect(animalAuthoritySnapshot(f.game.world, false)?.night?.status).toBe("aborted");
});
