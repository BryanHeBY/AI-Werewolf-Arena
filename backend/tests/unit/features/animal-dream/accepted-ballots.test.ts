/**
 * 单元测试负责动物放逐接受票的快照、末次复验和封票失败前缀。
 * 输入为既有原阵容 fixture、真实 authority 与明确回调／JSON 失败；字面票据、终态和未付款库存是预期。
 * 只调用真实接受票 owner，不复制校验算法、不运行完整对局、模型、传输或档案复现。
 */
import { expect, test } from "bun:test";
import { COMPONENT } from "../../../../src/core/domain/components/names";
import { animalRosterFixture } from "../../../support/features/animal-dream/builders/roster";
import {
  installAnimalAuthority,
  beginAnimalNight,
  closeAnimalNight,
  beginAnimalExileUnit,
  animalAuthoritySnapshot,
  animalPufferChoiceActor,
} from "../../../../src/game/mechanisms/roles/animal_dream/authority";
import { recordAnimalBallotRound, sealAnimalBallots } from "../../../../src/game/mechanisms/roles/animal_dream/accepted-ballots";

function fixture() {
  const f = animalRosterFixture(undefined, installAnimalAuthority);
  beginAnimalNight(f.world, 1, () => true);
  closeAnimalNight(f.world, 1, "normal");
  return f;
}
function votes(f: ReturnType<typeof fixture>, selected: Record<number, number> = {}) {
  return f.world.getAliveEntityIds().map((actorId) => {
    const targetId = selected[actorId] ?? null;
    return { actorId, targetId, abstain: targetId === null, weight: targetId === null ? 0 : 1 };
  });
}

test("原票与 PK 候选均在首次 guard 前捕获，回调改输入不改已接受账本", () => {
  const f = fixture(), raw = votes(f), candidates: number[] = [];
  let armed = false, calls = 0;
  const token = beginAnimalExileUnit(f.world, 1, "exile", () => {
    if (armed) {
      calls++;
      raw[1]!.targetId = 12;
      raw[1]!.abstain = false;
      raw[1]!.weight = 1;
      candidates.push(99);
    }
    return true;
  });
  armed = true;
  recordAnimalBallotRound(f.world, token, 1, raw, candidates);
  armed = false;
  expect(calls).toBe(2);
  expect(candidates).toEqual([99, 99]);
  expect(animalAuthoritySnapshot(f.world)!.unit!.ballots[0]!.votes[1]).toEqual({
    actorId: 2, targetId: null, abstain: true, weight: 0,
  });
  sealAnimalBallots(f.world, token);
  expect(animalPufferChoiceActor(f.world, token)).toBeNull();
  expect(animalAuthoritySnapshot(f.world)!.puffer.usedDay).toBeNull();
});

test("末次 guard 更换同形票权对象也撤销原单元，停止发生在账本安装前", () => {
  const f = fixture();
  let armed = false, calls = 0;
  const token = beginAnimalExileUnit(f.world, 1, "exile", () => {
    if (armed && ++calls === 2) {
      const voting = f.world.getComponent(2, COMPONENT.VotingRight)!;
      f.world.addComponent(2, COMPONENT.VotingRight, { ...voting });
    }
    return true;
  });
  armed = true;
  expect(() => recordAnimalBallotRound(f.world, token, 1, votes(f, { 2: 12 }))).toThrow("animal_ballot_round_revoked");
  armed = false;
  const snapshot = animalAuthoritySnapshot(f.world, false)!;
  expect(snapshot.stopped).toBe(true);
  expect(snapshot.unit!.status).toBe("aborted");
  expect(snapshot.unit!.ballots).toEqual([]);
  expect(snapshot.unit!.finalRound).toBeNull();
  expect(snapshot.puffer.usedDay).toBeNull();
  expect(() => sealAnimalBallots(f.world, token)).toThrow("animal_exile_unit_unavailable");
});

test("封票先写最终轮次，后续库存 JSON 解码失败保留封票且不建立付款租约", () => {
  const f = fixture(), token = beginAnimalExileUnit(f.world, 1, "exile", () => true);
  recordAnimalBallotRound(f.world, token, 1, votes(f, { 2: 12 }));
  const parse = JSON.parse, failure = new Error("literal_puffer_stock_decode_failure");
  let calls = 0;
  // 仅同步封票期间截获原解码调用，finally 恢复；不改 live 库存或生产授权规则。
  JSON.parse = (() => { calls++; throw failure; }) as typeof JSON.parse;
  try {
    expect(() => sealAnimalBallots(f.world, token)).toThrow(failure);
  } finally {
    JSON.parse = parse;
  }
  const snapshot = animalAuthoritySnapshot(f.world)!;
  expect(calls).toBe(1);
  expect(snapshot.unit!.finalRound).toBe(1);
  expect(snapshot.unit!.ballots).toHaveLength(1);
  expect(snapshot.unit!.puffer).toBeNull();
  expect(snapshot.puffer.usedDay).toBeNull();
  expect(snapshot.puffer.history).toEqual([]);
  expect(() => sealAnimalBallots(f.world, token)).toThrow("animal_ballot_round_unavailable");
});
