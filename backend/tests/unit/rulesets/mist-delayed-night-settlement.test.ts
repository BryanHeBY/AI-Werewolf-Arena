/**
 * 单元测试验证雾鸦延迟夜的同步交接、原生命拒绝和已付／死亡失败前缀。输入为公开板子的真实
 * 装配、原蛇窗口及明确的受控回复；字面状态／读序／库存和错误是独立预期，不运行完整周期或模型。
 * 经理同样只等待原蛇与真实死亡两处 Promise；死亡失败不推进完成段，外层 abort 责任不交新序列。
 */
import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { bootstrapGame } from "../../../src/app/bootstrap";
import { parseBoardDefinition } from "../../../src/runtime/config/board_definition";
import { Role, Phase, DeathCause, type GameEvent } from "@ai-werewolf-arena/game-contract";
import type { ActionProvider } from "../../../src/core/domain/actions";
import { COMPONENT } from "../../../src/core/domain/components/names";
import { aliveLifeVersion } from "../../../src/core/domain/components/alive";
import { DreamNightFrame } from "../../../src/game/mechanisms/roles/dreamer/night_frame";
import { beginMistNight, commitMistChoice, handOffMistNight, closeMistNight, abortMistNight } from "../../../src/game/mechanisms/roles/mist_raven/night_frame";
import { readAlchemistState } from "../../../src/game/mechanisms/roles/mist_raven/state";
import { DeathResolution } from "../../../src/game/engine/death_resolution";
import { EventRegistry } from "../../../src/game/engine/event_registry";
import { ToolGateway } from "../../../src/game/gateway/tool_gateway";
import { prepareMistDelayedNight, settleMistDelayedNight, type MistPreparedNightDamage } from "../../../src/rulesets/mist-delayed-night-settlement";

const board = parseBoardDefinition(JSON.parse(readFileSync(new URL("../../../../configs.example/boards/awa_mist_raven_12_v1.json", import.meta.url), "utf8"))).config;
function fixture(poison = false) {
  const roles = [Role.Alchemist, Role.Seer, Role.Dreamer, Role.Idiot, Role.Villager, Role.Villager, Role.Villager, Role.Villager, Role.RavenClawWolf, Role.Wolf, Role.Wolf, Role.Wolf];
  const game = bootstrapGame(structuredClone(board), { fixedRoles: roles });
  beginMistNight(game.world, 1);
  commitMistChoice(game.world, 1, null);
  handOffMistNight(game.world, 1, 5);
  const night = {
    deathLives: new Map(game.world.getAliveEntityIds().map(id => {
      const life = game.world.getComponent(id, COMPONENT.Alive)!;
      return [id, {life, version: aliveLifeVersion(life)}] as const;
    })),
    summary: {wolfTarget: 5},
    damage: {deaths:[5], deathSources:{5:poison ? [DeathCause.WolfKill, DeathCause.Poison] : [DeathCause.WolfKill]}},
    dreamFrame: new DreamNightFrame([]),
  };
  return { ...game, night };
}

function settlement(f: ReturnType<typeof fixture>, provider: ActionProvider, close: () => void) {
  const pending = prepareMistDelayedNight({world: f.world, cycleDay:1, night:f.night});
  const events: GameEvent[] = [];
  const gateway = new ToolGateway();
  const sequence = settleMistDelayedNight({
    pending, world:f.world, events, toolGateway:gateway, cycleDay:1,
    lifecycle:{closeMistNormally(day) {close();closeMistNight(f.world, day);}},
  }, provider, () => true, false);
  const resolution = new DeathResolution(f.world, events, gateway, new EventRegistry(), {day:1, phase:Phase.Day, gameOver:false, result:null});
  return {pending,events,sequence,resolution};
}

test("建立时旧生命拒绝先于伤害与梦读取，不替换尚未发布的pending", () => {
  const f = fixture(), trace:string[]=[];
  // 只损坏交接快照的版本；真实原体不撤销，以便精确进入原 pending 生命检查而非更早名单拒绝。
  const scope = f.night.deathLives.get(5)!;
  (scope as {version:number|undefined}).version=scope.version!+1;
  const night = {
    deathLives:f.night.deathLives,
    get summary(): never {trace.push("summary");throw new Error("summary_must_not_read");},
    get damage(): never {trace.push("damage");throw new Error("damage_must_not_read");},
    get dreamFrame(): never {trace.push("dream");throw new Error("dream_must_not_read");},
  };
  expect(() => prepareMistDelayedNight({world:f.world, cycleDay:1, night})).toThrow("mist_pending_life_stale");
  expect(trace).toEqual([]);
  expect(f.world.getAliveEntityIds()).toHaveLength(12);
});

test("同步序列交原蛇Promise，真实死亡完成之后才finish和正常关闭", async () => {
  const f=fixture(),trace:string[]=[];
  const s=settlement(f,{async getAction(request) {
    if(request.context.stage==="alchemist_snake") {trace.push("provider");return {name:"use_snake",args:{target_id:null}};}
    return {name:"speak",args:{text:"Original words"}};
  }},()=>trace.push("closed"));
  try {
    expect(s.pending.status).toBe("pending");
    const first=s.sequence.next();
    expect(first.done).toBe(false);
    expect(first.value).toBeInstanceOf(Promise);
    expect(trace).toEqual(["provider"]);
    expect(s.pending.status).toBe("committing");
    queueMicrotask(()=>trace.push("queued"));
    const healed=await (first.value as Promise<number|null>);
    trace.push("snake-complete");
    const {damage,current}=s.sequence.next(healed).value as MistPreparedNightDamage;
    trace.push("damage-ready");
    expect(damage.deaths).toEqual([5]);
    expect(s.pending.status).toBe("committing");
    expect(f.world.getComponent(5,COMPONENT.Alive)!.alive).toBe(true);
    await s.resolution.resolve(damage.deaths,damage.deathSources,{async getAction(){return {name:"speak",args:{text:"Original words"}};}},Phase.Night,Phase.Day,{}, {dreams:f.night.dreamFrame,nightOriginIds:damage.deaths,isCurrent:current});
    trace.push("death-complete");
    expect(s.pending.status).toBe("committing");
    expect(s.sequence.next().done).toBe(true);
    expect(s.pending.status).toBe("committed");
    expect(trace).toEqual(["provider","queued","snake-complete","damage-ready","death-complete","closed"]);
  } finally {abortMistNight(f.world);}
});

test("蛇已疗救但死亡await失败时保付款和标死前缀，不恢复finish或正常关闭", async () => {
  const f=fixture(true),failure=new Error("literal_mist_death_failed");let closed=0;
  const s=settlement(f,{async getAction(){return {name:"use_snake",args:{target_id:5}};}},()=>closed++);
  try {
    const healed=await (s.sequence.next().value as Promise<number|null>);
    const {damage,current}=s.sequence.next(healed).value as MistPreparedNightDamage;
    expect(damage).toMatchObject({deaths:[5],deathSources:{5:[DeathCause.Poison]}});
    expect(readAlchemistState((f.world.getComponent(1,COMPONENT.Role)!.privateState as {alchemist?:unknown}).alchemist)!.healRemaining).toBe(0);
    await expect(s.resolution.resolve(damage.deaths,damage.deathSources,{async getAction(){throw failure;}},Phase.Night,Phase.Day,{}, {isCurrent:current})).rejects.toBe(failure);
    expect(f.world.getComponent(5,COMPONENT.Alive)!.alive).toBe(false);
    expect(s.pending.status).toBe("committing");
    expect(closed).toBe(0);
    s.pending.abort();
    expect(s.pending.status).toBe("aborted");
    expect(readAlchemistState((f.world.getComponent(1,COMPONENT.Role)!.privateState as {alchemist?:unknown}).alchemist)!.healRemaining).toBe(0);
  } finally {abortMistNight(f.world);}
});
