import type { ActionStage, Role, ToolCall } from "../../src/core";
export interface PlannedTurn { day: number; stage: ActionStage; action: ToolCall | null }
export interface ActorTransportPlan { actorId: number; role: Role; locale: "zh-CN" | "en"; turns: PlannedTurn[] }

/** Literal S01/S04/S02/S03 oracle; transport actors never query engine truth. */
export function foundationTransportPlan(size: 6 | 12, alternate = false) {
  const rows = new Map<number, PlannedTurn[]>(Array.from({ length: size }, (_, index) => [index + 1, []]));
  const add = (day: number, actors: number[], stage: ActionStage, action: ToolCall | null | ((actor: number) => ToolCall | null)) => {
    for (const actor of actors) rows.get(actor)!.push({ day, stage, action: typeof action === "function" ? action(actor) : action });
  };
  const wolves = (day: number, actors: number[], target: number) => {
    add(day, actors, "wolf_discussion", { name: "speak_to_wolves", args: { text: "End discussion", end_chat: true } });
    add(day, actors, "wolf_vote", { name: "kill_vote", args: { target_id: target, abstain: false } });
  };
  const speech = (day: number, actors: number[]) => add(day, actors, "day_speech", actor => ({ name: "speak", args: { text: `Day ${day}, seat ${actor}` } }));
  const vote = (day: number, actors: number[], target: number) => add(day, actors, "voting", { name: "vote", args: { target_id: target, abstain: false } });
  const last = (day: number, actor: number) => add(day, [actor], "last_words", { name: "speak", args: { text: `Last words ${actor}` } });
  if (size === 6) {
    wolves(1, [1, 4], 3);
    add(1, [5], "guard", { name: "guard", args: { target_id: alternate ? 3 : 6, abstain: false } });
    add(1, [2], "seer", { name: "check_identity", args: { target_id: 1 } });
    if (!alternate) last(1, 3);
    const day1 = alternate ? [1, 2, 3, 4, 5, 6] : [1, 2, 4, 5, 6];
    speech(1, day1); vote(1, day1, 1); last(1, 1);
    wolves(2, [4], 5);
    add(2, [5], "guard", { name: "guard", args: { target_id: alternate ? 6 : null, abstain: !alternate } });
    add(2, [2], "seer", { name: "check_identity", args: { target_id: 4 } });
    const day2 = alternate ? [2, 3, 4, 6] : [2, 4, 6]; speech(2, day2); vote(2, day2, 4); last(2, 4);
  } else {
    const all = Array.from({ length: 12 }, (_, index) => index + 1);
    wolves(1, [1, 2, 3, 4], 9);
    add(1, [6], "witch", { name: "use_potion", args: { target_id: 9, potion_type: "heal" } });
    add(1, [5], "seer", { name: "check_identity", args: { target_id: 1 } });
    add(1, all, "sheriff_nomination", actor => ({ name: "run_for_sheriff", args: { run: actor === 8 || actor === 10 } }));
    add(1, [8, 10], "sheriff_campaign_speech", { name: "speak", args: { text: "Campaign" } });
    add(1, [8, 10], "sheriff_withdraw", actor => ({ name: "run_for_sheriff", args: { run: actor === 8 } }));
    add(1, all.filter(id => id !== 8), "sheriff_vote", { name: "vote_for_sheriff", args: { target_id: 8, abstain: false } });
    add(1, [8], "sheriff_choose_direction", { name: "choose_direction", args: { direction: "clockwise" } });
    speech(1, all); add(1, [1, 2, 3, 4], "on_pre_vote", null); vote(1, all, alternate ? 8 : 1); if (!alternate) last(1, 1);
    wolves(2, alternate ? [1, 2, 3, 4] : [2, 3, 4], 7);
    add(2, [6], "witch", { name: "use_potion", args: { target_id: 4, potion_type: "poison" } });
    add(2, [5], "seer", { name: "check_identity", args: { target_id: 2 } });
    add(2, [7], "hunter_shot", { name: "shoot", args: { target_id: 3 } });
    add(2, [alternate ? 1 : 8], "sheriff_choose_direction", { name: "choose_direction", args: { direction: "clockwise" } });
    speech(2, alternate ? [1, 2, 5, 6, 8, 9, 10, 11, 12] : [2, 5, 6, 8, 9, 10, 11, 12]);
    if (alternate) {
      add(2, [1, 2], "on_pre_vote", null); vote(2, [1, 2, 5, 6, 9, 10, 11, 12], 1); last(2, 1);
      wolves(3, [2], 5); add(3, [6], "witch", { name: "use_potion", args: { target_id: 6, potion_type: "none" } });
      add(3, [5], "seer", { name: "check_identity", args: { target_id: 2 } });
      add(3, [2], "sheriff_choose_direction", { name: "choose_direction", args: { direction: "clockwise" } }); speech(3, [2, 6, 8, 9, 10, 11, 12]);
    }
    add(alternate ? 3 : 2, [2], "on_pre_vote", { name: "self_destruct", args: { reason: "Final wolf", confirm: true } });
  }
  return rows;
}
