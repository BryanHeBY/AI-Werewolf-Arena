/**
 * 测试支持模块负责根据六／十二人数及 success／tie／abstain 结果分支构造杠精传输输入，输出原板子、内部固定种子、身份与字面挑战／投票回合。不接收任意语言或种子，不执行辩论结算来计算预期。
 */
import { Role } from "../../../../../src/domain";
import { PotionType } from "../../../../../src/domain";
import { createRandom } from "../../../../../src/domain";
import { shuffled } from "../../../../../src/domain";
import type { ActionStage } from "../../../../../src/domain";
import type { ToolCall } from "../../../../../src/domain";
import { foxBoard } from "../../cursed-fox/builders/scenario";
import { boardDefinitionFromConfig } from "../../../../../src/app/config/board-definition";
import { parseBoardDefinition } from "../../../../../src/app/config/board-definition";
import type { PlannedTurn } from "../../../transport/contracts";
import type { TransportGameScenario } from "../../../transport/contracts";

export function debaterScenario(
  size: 6 | 12,
  outcome: "success" | "tie" | "abstain",
): TransportGameScenario {
  const deck = [
      Role.Debater,
      Role.Hunter,
      ...Array<Role>(size === 6 ? 1 : 4).fill(Role.Wolf),
      Role.Witch,
      Role.Seer,
      ...Array<Role>(size === 6 ? 1 : 4).fill(Role.Villager),
    ],
    config = foxBoard(deck),
    seed = `debater-${size}-${outcome}`,
    roles = shuffled(deck, createRandom(seed).fork("deal")),
    ids = roles.map((_, i) => i + 1),
    actor = roles.indexOf(Role.Debater) + 1,
    target = ids.find((id) => id !== actor)!,
    witch = roles.indexOf(Role.Witch) + 1,
    seer = roles.indexOf(Role.Seer) + 1,
    wolves = ids.filter((id) => roles[id - 1] === Role.Wolf),
    villagers = ids.filter((id) => roles[id - 1] === Role.Villager),
    turns = new Map(ids.map((id) => [id, [] as PlannedTurn[]]));
  const add = (
    day: number,
    actors: number[],
    stage: ActionStage,
    action: ToolCall | null | ((id: number) => ToolCall | null),
  ) => {
    for (const id of actors)
      turns
        .get(id)!
        .push({ day, stage, action: typeof action === "function" ? action(id) : action });
  };
  const dead = new Set<number>();
  for (let day = 1; day <= wolves.length; day++) {
    const liveWolves = wolves.filter((id) => !dead.has(id)),
      knife = villagers[day - 1]!;
    add(day, liveWolves, "wolf_discussion", {
      name: "speak_to_wolves",
      args: { text: "Done", end_chat: true },
    });
    add(day, liveWolves, "wolf_vote", {
      name: "kill_vote",
      args: { target_id: knife, abstain: false },
    });
    add(day, [seer], "seer", { name: "check_identity", args: { target_id: liveWolves[0]! } });
    add(
      day,
      [witch],
      "witch",
      day === 1
        ? { name: "use_potion", args: { target_id: knife, potion_type: PotionType.Heal } }
        : { name: "use_potion", args: { target_id: witch, potion_type: PotionType.None } },
    );
    if (day > 1) dead.add(knife);
    const alive = ids.filter((id) => !dead.has(id));
    // 挑战发生在首个其他普通发言者之前；此前只可有行动者本人发言。
    if (day === 1) {
      if (alive[0] === actor)
        add(day, [actor], "day_speech", { name: "speak", args: { text: "Speech" } });
      add(day, [actor], "debate_challenge", { name: "challenge", args: { target_id: target } });
      add(day, [actor, target], "debate_speech", { name: "speak", args: { text: "Debate" } });
      add(day, alive, "debate_ballot", (id) => ({
        name: "debate_vote",
        args: {
          support:
            alive.indexOf(id) < size / 2 + (outcome === "success" ? 1 : 0)
              ? true
              : outcome === "abstain"
                ? null
                : false,
        },
      }));
    }
    const speakers = alive.filter(
      (id) =>
        !(day === 1 && outcome === "success" && id === target) &&
        !(day === 1 && alive[0] === actor && id === actor),
    );
    add(day, speakers, "day_speech", { name: "speak", args: { text: "Speech" } });
    const blocked = day === 1 ? (outcome === "success" ? target : actor) : null,
      exile = liveWolves[0]!;
    add(
      day,
      alive.filter((id) => id !== blocked),
      "voting",
      (id) => ({
        name: "vote",
        args: { target_id: id === exile ? null : exile, abstain: id === exile },
      }),
    );
    add(day, [exile], "last_words", { name: "speak", args: { text: "Exile last" } });
    dead.add(exile);
  }
  return {
    roles,
    board: parseBoardDefinition(boardDefinitionFromConfig(`debater_${size}_${outcome}`, config)),
    seed,
    turns,
    promptAssertions: (id, locale) =>
      id === actor
        ? {
            requiredCurrentMarkers: [
              locale === "en" ? "You are the Good god Debater" : "你是好人神职杠精",
            ],
            forbiddenCurrentMarkers: ['"ballots"', '"voterId"'],
          }
        : {},
  };
}
