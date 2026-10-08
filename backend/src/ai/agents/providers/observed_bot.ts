import { PotionType, type ToolCall, type RandomDraws } from "../../../core";
import type { ObservedPlayerStrategy, PlayerObservation } from "../player/observation";
import { readSeerInspectionResult } from "@ai-werewolf-arena/replay-contract";

export type BotStyle = "active" | "conservative" | "competitive" | "random";

/** Stateful only for this player's named RNG; never holds World or another player's role. */
export class ObservedBot implements ObservedPlayerStrategy {
  constructor(private readonly random: RandomDraws, private readonly style: BotStyle) {}

  async decide(observation: PlayerObservation): Promise<ToolCall | null> {
    const { request, knownAliveIds, ownState, teammateIds } = observation;
    const actor = request.actorId;
    const others = knownAliveIds.filter(id => id !== actor);
    const pick = (ids: number[]) => ids.length ? ids[Math.floor(this.random.next() * ids.length)] : undefined;
    const tools = request.allowedTools;
    if (tools.includes("speak")) return { name: "speak", args: { text: `Seat ${actor}, day ${request.context.day}: consider the public evidence.` } };
    if (tools.includes("speak_to_wolves")) return { name: "speak_to_wolves", args: { text: "End discussion", end_chat: true } };
    if (tools.includes("choose_direction")) return { name: "choose_direction", args: { direction: this.random.next() < 0.5 ? "clockwise" : "counter_clockwise" } };
    if (tools.includes("run_for_sheriff")) return { name: "run_for_sheriff", args: { run: request.context.stage === "sheriff_withdraw" || this.style === "competitive" || actor % 3 === 0 } };
    if (tools.includes("vote_for_sheriff")) {
      const target = pick(request.context.sheriff_candidates?.filter(id => id !== actor) ?? []);
      return { name: "vote_for_sheriff", args: { target_id: target ?? null, abstain: target === undefined } };
    }
    if (tools.includes("kill_vote")) {
      const target = pick(others.filter(id => !teammateIds.includes(id)));
      return { name: "kill_vote", args: { target_id: target ?? null, abstain: target === undefined } };
    }
    if (tools.includes("mechanical_mode")) {
      const state = ownState.mechanical;
      const ready = state?.hasInheritedKnife && state.firstKnifeNight !== null && state.firstKnifeNight <= request.context.day;
      return this.style === "conservative" ? null : { name: "mechanical_mode", args: { mode: ready ? "kill" : "skill" } };
    }
    if (tools.includes("mimic_role")) { const target = this.style === "conservative" && request.context.day === 1 ? undefined : pick(others); return target === undefined ? null : { name: "mimic_role", args: { target_id: target } }; }
    if (tools.includes("mechanical_inspect")) { const target = pick(others); return this.style === "conservative" || target === undefined ? null : { name: "mechanical_inspect", args: { target_id: target } }; }
    if (tools.includes("mechanical_poison")) { const target = pick(others); return this.style === "conservative" || target === undefined ? null : { name: "mechanical_poison", args: { target_id: target } }; }
    if (tools.includes("mechanical_guard")) return { name: "mechanical_guard", args: { target_id: this.style === "conservative" ? null : pick(knownAliveIds) ?? null } };
    if (tools.includes("mechanical_attack")) return { name: "mechanical_attack", args: { target_id: pick(others) ?? null } };
    if (tools.includes("guard")) {
      const target = this.style === "conservative" ? undefined : pick(knownAliveIds.filter(id => id !== ownState.guard?.lastTarget));
      return { name: "guard", args: { target_id: target ?? null, abstain: target === undefined } };
    }
    if (tools.includes("dream")) {
      const target=pick(others);if(target!==undefined)return{name:"dream",args:{target_id:target}};
    }
    if(tools.includes("charm")){
      const previous=ownState.wolfBeauty?.history.at(-1),target=this.style==="conservative"?undefined:pick(others.filter(id=>previous?.day!==request.context.day-1||previous.targetId!==id));
      return{name:"charm",args:{target_id:target??null}};
    }
    if (tools.includes("check_identity")) {
      const checked = ownState.seer?.history.map(entry => entry.targetId) ?? [];
      const fresh = others.filter(id => !checked.includes(id));
      const target = pick(fresh.length ? fresh : others);
      if (target !== undefined) return { name: "check_identity", args: { target_id: target } };
    }
    if(tools.includes("inspect_role")){if(this.style==="conservative"&&request.context.stage==="psychic")return null;const state=ownState.roleInspection,target=pick(others.filter(id=>state?.policy==="psychic"||!state?.history.some(report=>report.targetId===id)));if(target!==undefined)return{name:"inspect_role",args:{target_id:target}};}
    if (tools.includes("use_potion")) {
      const witch = ownState.witch;
      const knife = request.context.wolf_target;
      if (this.style !== "conservative" && witch && typeof knife === "number" && knownAliveIds.includes(knife) && witch.heal > 0 && (knife !== actor || witch.canSelfHeal)) {
        return { name: "use_potion", args: { target_id: knife, potion_type: PotionType.Heal } };
      }
      if (this.style !== "conservative" && witch && witch.poison > 0 && request.context.day > 1) {
        const target = pick(others);
        if (target !== undefined) return { name: "use_potion", args: { target_id: target, potion_type: PotionType.Poison } };
      }
      return { name: "use_potion", args: { target_id: actor, potion_type: PotionType.None } };
    }
    if (tools.includes("shoot")) {
      const target = pick(others);
      if (target !== undefined) return { name: "shoot", args: { target_id: target } };
    }
    if (tools.includes("duel")) {
      if (this.style !== "active" || ownState.knight?.canDuel !== true || this.random.next() >= 0.5) return null;
      const target = pick(others);
      return target === undefined ? null : { name: "duel", args: { target_id: target, confirm: true } };
    }
    if (tools.includes("vote")) {
      const revealed = request.context.visible_events.filter(event => event.type === "idiot_revealed").map(event => event.payload.targetId);
      const histories = observation.abilities?.filter(ability => ability.kind === "seer_check").flatMap(ability => ability.state.history) ?? ownState.seer?.history ?? [];
      const seenWolves = histories.filter(entry => entry.isWerewolf).map(entry => entry.targetId);
      for (const event of request.context.visible_events) {
        if (event.type !== "seer_checked") continue;
        const result = readSeerInspectionResult(event.payload);
        if (result?.kind === "camp" && result.camp === "wolf" && typeof event.payload.targetId === "number") seenWolves.push(event.payload.targetId);
      }
      const candidates = others.filter(id => !revealed.includes(id) && !teammateIds.includes(id));
      const known = candidates.filter(id => seenWolves.includes(id));
      const target = pick(known.length ? known : candidates);
      return { name: "vote", args: { target_id: target ?? null, abstain: target === undefined } };
    }
    if (tools.includes("self_destruct_with_target")) {
      if (this.style !== "active" || ownState.whiteWolfKing?.canDetonate !== true || this.random.next() >= 0.5) return null;
      const target = pick(others.filter(id => !teammateIds.includes(id)));
      return { name: "self_destruct_with_target", args: { reason: "Active simulated strategy", confirm: true, target_id: target ?? null } };
    }
    if (tools.includes("self_destruct")) {
      return this.style === "active" && request.context.day > 1 && this.random.next() < 0.25
        ? { name: "self_destruct", args: { reason: "Active simulated strategy", confirm: true } } : null;
    }
    throw new Error("observed_bot_action_not_supported");
  }
}
