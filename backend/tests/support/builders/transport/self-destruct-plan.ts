/**
 * Builds original shared test test input plans, fixed boards and explicit player/marker data. Inputs are
 * supplied variant/locale/seed choices; outputs retain the same arrays, stock parameters and configured
 * identities. Existing dealing may construct input identities, while handwritten expected outcomes remain
 * supplied data. It runs no game or model and changes no oracle algorithm.
 */
import { ActionWindow } from "../../../../src/domain";
import type { ToolCall } from "../../../../src/domain";
import type { PlannedTurn } from "../../transport/contracts";

export function selfDestructTransportPlan(window: ActionWindow): Map<number, PlannedTurn[]> {
  const rows = new Map<number, PlannedTurn[]>(
    Array.from({ length: 6 }, (_, index) => [index + 1, []]),
  );
  const add = (
    day: number,
    actors: number[],
    stage: PlannedTurn["stage"],
    action: ToolCall | null | ((actor: number) => ToolCall | null),
  ) => {
    for (const actor of actors)
      rows
        .get(actor)!
        .push({ day, stage, action: typeof action === "function" ? action(actor) : action });
  };
  const wolves = (day: number, actors: number[], target: number) => {
    add(day, actors, "wolf_discussion", {
      name: "speak_to_wolves",
      args: { text: "End discussion", end_chat: true },
    });
    add(day, actors, "wolf_vote", {
      name: "kill_vote",
      args: { target_id: target, abstain: false },
    });
  };
  const speech = (day: number, actors: number[]) =>
    add(day, actors, "day_speech", (actor) => ({
      name: "speak",
      args: { text: `Day ${day}, seat ${actor}` },
    }));
  const explode = (day: number, actors: number[], winner: number) =>
    add(day, actors, window, (actor) =>
      actor === winner
        ? { name: "self_destruct", args: { reason: "Literal window decision", confirm: true } }
        : null,
    );
  wolves(1, [1, 4], 3);
  add(1, [5], "guard", { name: "guard", args: { target_id: null, abstain: true } });
  add(1, [2], "seer", { name: "check_identity", args: { target_id: 1 } });
  if (window === ActionWindow.OnPreElection) explode(1, [1, 4], 1);
  else {
    add(1, [1, 2, 3, 4, 5, 6], "sheriff_nomination", (actor) => ({
      name: "run_for_sheriff",
      args: { run: actor === 2 },
    }));
    add(1, [2], "sheriff_campaign_speech", { name: "speak", args: { text: "Campaign" } });
    add(1, [2], "sheriff_withdraw", { name: "run_for_sheriff", args: { run: true } });
    add(1, [1, 3, 4, 5, 6], "sheriff_vote", {
      name: "vote_for_sheriff",
      args: { target_id: 2, abstain: false },
    });
  }
  add(1, [3], "last_words", { name: "speak", args: { text: "Last words 3" } });
  if (window === ActionWindow.OnDaybreak) explode(1, [1, 4], 1);
  if (window === ActionWindow.OnPerSpeechGap || window === ActionWindow.OnPreVote) {
    add(1, [2], "sheriff_choose_direction", {
      name: "choose_direction",
      args: { direction: "clockwise" },
    });
    speech(1, window === ActionWindow.OnPerSpeechGap ? [4] : [4, 5, 6, 1, 2]);
    explode(1, [1, 4], 1);
  }
  wolves(2, [4], 5);
  add(2, [5], "guard", { name: "guard", args: { target_id: null, abstain: true } });
  add(2, [2], "seer", { name: "check_identity", args: { target_id: 4 } });
  if (window === ActionWindow.OnPreElection) {
    speech(2, [2, 4, 6]);
    add(2, [2, 4, 6], "voting", { name: "vote", args: { target_id: 4, abstain: false } });
    add(2, [4], "last_words", { name: "speak", args: { text: "Last words 4" } });
  } else {
    if (window !== ActionWindow.OnDaybreak) {
      add(2, [2], "sheriff_choose_direction", {
        name: "choose_direction",
        args: { direction: "clockwise" },
      });
      speech(2, window === ActionWindow.OnPerSpeechGap ? [4] : [4, 6, 2]);
    }
    explode(2, [4], 4);
  }
  return rows;
}
