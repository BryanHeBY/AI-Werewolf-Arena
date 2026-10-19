/**
 * 单元测试负责角色主题色的全量登记、亮暗面可读性、历史主题补齐和身份披露验收。输入为正式角色集合、手写玩家与主题覆盖。
 * 预期使用明确角色、独立对比度公式和当前可见身份；不从后端阵营、昵称、LLM图标或台词推颜色与底牌。
 */
import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ROLE_IDS } from "@ai-werewolf-arena/game-contract";
import { ROLE_COLOR_KEYS } from "../../../src/themes/role-colors";
import {
  normalizeResolvedTheme,
  resolveTheme,
  roleAppearance,
  themePalette,
  themeToCssVariables,
  type ThemeDefinition,
  actionAppearance,
} from "../../../src/themes";
import { PlayerSeats } from "../../../src/replay/PlayerSeats";
import { VIDEO_VISUAL_FAMILIES } from "../../../src/video/visual-vocabulary";
import type { VideoVisualFamily, VideoVisualIntent } from "../../../src/video/types";
import { eventScene } from "../../../src/video/semantic-scenes";
import { broadcastSceneLayout } from "../../../src/video/scene-classification";
import type { ReplayEvent } from "@ai-werewolf-arena/replay-contract";

function rgb(hex: string) {
  return [1, 3, 5].map((offset) => parseInt(hex.slice(offset, offset + 2), 16));
}
function luminance(values: number[]) {
  return values.reduce((sum, value, index) => {
    const channel = value / 255;
    return (
      sum +
      [0.2126, 0.7152, 0.0722][index]! *
        (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
    );
  }, 0);
}
function contrast(ink: string, panel: string, tint: number, wash = ink) {
  const foreground = rgb(ink),
    base = rgb(panel),
    tintRgb = rgb(wash),
    background = base.map((value, index) => value * (1 - tint) + tintRgb[index]! * tint);
  const a = luminance(foreground),
    b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}
test("all 64 formal roles have deliberate art families, with related wolf variants and distinct classic gods", () => {
  expect(Object.keys(ROLE_COLOR_KEYS).sort()).toEqual([...ROLE_IDS].sort());
  const theme = resolveTheme("gothic-v1");
  expect(roleAppearance(theme, "night", "wolf").key).toBe("blood");
  expect(roleAppearance(theme, "night", "wolf_beauty").key).toBe("rose");
  expect(roleAppearance(theme, "night", "awakened_wolf_beauty").key).toBe("rose");
  expect(roleAppearance(theme, "night", "mechanical_wolf").key).toBe("iron");
  const inks = [
    "wolf",
    "wolf_beauty",
    "wolf_king",
    "villager",
    "seer",
    "witch",
    "guard",
    "hunter",
    "knight",
  ].map((role) => roleAppearance(theme, "night", role).ink);
  expect(new Set(inks).size).toBe(9);
  for (const id of ["unknown", "toString", "__proto__", "seer_checked"])
    expect(roleAppearance(theme, "night", id).key).toBe("neutral");
});
test("role text remains readable on each theme's normal and active card wash in both tones", () => {
  for (const id of ["gothic-v1", "minimal-v1"] as const)
    for (const tone of ["day", "night"] as const) {
      const theme = resolveTheme(id),
        panel = themePalette(theme, tone).panel;
      for (const role of ROLE_IDS) {
        const skin = roleAppearance(theme, tone, role);
        const activity = theme.definition.frame.activity;
        const washes = [
          [skin.ink, 0.23],
          [themePalette(theme, tone).accent, 0.23],
          [activity.candidate, 0.18],
          [activity.candidateSpeaker, 0.23],
          [activity.wolfSpeaker, 0.23],
        ] as const;
        for (const [wash, opacity] of washes)
          for (const tint of [0, opacity])
            expect(
              contrast(skin.ink, panel, tint, wash),
              `${id}/${tone}/${role}/${tint}/${wash}`,
            ).toBeGreaterThanOrEqual(4.5);
      }
    }
});
test("legacy themes gain independent role defaults while explicit per-theme hue and family overrides survive", () => {
  const old = resolveTheme("gothic-v1");
  delete (old.definition as Partial<ThemeDefinition>).roleColors;
  delete (old.definition as Partial<ThemeDefinition>).actionColors;
  const before = JSON.stringify(old),
    restored = normalizeResolvedTheme(old);
  expect(roleAppearance(restored, "night", "witch").key).toBe("amethyst");
  expect(Object.keys(restored.definition.actionColors.families).sort()).toEqual(
    [...VIDEO_VISUAL_FAMILIES].sort(),
  );
  expect(JSON.stringify(old)).toBe(before);
  restored.definition.roleColors.palette.night.rose = "#ffb2bc";
  restored.definition.roleColors.roles.wolf_beauty = "amethyst";
  const copy = normalizeResolvedTheme(restored);
  expect(copy.definition.roleColors.palette.night.rose).toBe("#ffb2bc");
  expect(roleAppearance(copy, "night", "wolf_beauty").key).toBe("amethyst");
  expect(roleAppearance(resolveTheme("gothic-v1"), "night", "wolf_beauty").key).toBe("rose");
  expect(themeToCssVariables(copy, "night")["--awa-role-wolf_beauty"]).toBe(
    roleAppearance(copy, "night", "witch").ink,
  );
  restored.definition.actionColors.families.pack_attack = "rose";
  const themed = normalizeResolvedTheme(restored);
  expect(actionAppearance(themed, "night", { visual: intent("pack_attack") }).ink).toBe("#ffb2bc");
  expect(
    actionAppearance(resolveTheme("gothic-v1"), "night", { visual: intent("pack_attack") }).ink,
  ).toBe("#f3b4bb");
});

function intent(family: VideoVisualFamily): VideoVisualIntent {
  return {
    family,
    template: "god_announcement/fact_card",
    process: "choice",
    requestedTargetIds: [],
    effectiveTargetIds: [],
    recipientIds: [],
    source: { eventSeqs: [], factSeqs: [] },
  };
}
test("action colors follow literal mechanisms and tools, never the actor, report answer or borrowed role", () => {
  const theme = resolveTheme("gothic-v1");
  for (const actorId of [undefined, 1, 8, 12])
    for (const process of ["choice", "resolved", "revoked"] as const) {
      expect(
        actionAppearance(theme, "night", { visual: { ...intent("pack_attack"), actorId, process } })
          .ink,
      ).toBe("#f3b4bb");
    }
  for (const camp of ["good", "wolf", "third_party"] as const) {
    expect(
      actionAppearance(theme, "night", {
        visual: { ...intent("inspection_camp"), report: { kind: "camp", camp } },
      }).key,
    ).toBe("azure");
  }
  for (const potion of ["heal", "poison"] as const)
    expect(
      actionAppearance(theme, "night", { visual: { ...intent("potion"), actorId: 8, potion } }).key,
    ).toBe("amethyst");
  expect(actionAppearance(theme, "night", { visual: intent("protection") }).key).toBe("teal");
  expect(
    actionAppearance(theme, "night", {
      visual: {
        ...intent("protection"),
        protection: { interaction: "wolf_attack_blocked", kind: "heal" },
      },
    }).key,
  ).toBe("amethyst");
  expect(
    actionAppearance(theme, "night", { visual: { ...intent("duel"), duelKind: "knight" } }).key,
  ).toBe("steel");
  expect(
    actionAppearance(theme, "night", { visual: { ...intent("death_action"), deathTool: "gun" } })
      .key,
  ).toBe("ochre");
  expect(actionAppearance(theme, "night", { visual: intent("death_action") }).key).toBe("neutral");
  expect(
    actionAppearance(theme, "night", {
      visual: { ...intent("inspection_camp"), fallbackReason: "unknown mechanism" },
    }).key,
  ).toBe("neutral");
  expect(
    actionAppearance(theme, "night", { action: { kind: "wolf-vote", status: "choice" } }).key,
  ).toBe("blood");
});

test("real native and copied knife/poison/gun event contracts produce the same action color and actual action layout", () => {
  const theme = resolveTheme("gothic-v1");
  for (const [type, key] of [
    ["mechanical_attack_chosen", "blood"],
    ["awakened_attack_chosen", "blood"],
    ["mechanical_poison_used", "amethyst"],
    ["mechanical_shot", "ochre"],
    ["wolf_king_shot", "ochre"],
  ] as const) {
    const record: ReplayEvent = {
      seq: 1,
      type,
      day: 1,
      phase: "night",
      timestamp: "acceptance",
      payload: { actorId: 1, targetId: 2, day: 1 },
    };
    const before = JSON.stringify(record);
    const scene = eventScene(
      record,
      [record],
      "Independent contract acceptance",
      "night",
      [1, 2],
      "zh-CN",
    );
    expect(scene.visual?.fallbackReason).toBeUndefined();
    expect(scene.visual?.actorId).toBe(1);
    expect(broadcastSceneLayout(scene)).toBe("action");
    expect(actionAppearance(theme, "night", scene).key).toBe(key);
    expect(JSON.stringify(record)).toBe(before);
  }
});
test("Web color reads only the visible identity, preserves dead grey and never recolors a supplied LLM avatar", () => {
  const players = [
    { playerId: 1, role: "unknown", camp: "wolf", alive: true, isSheriff: false, isWinner: false },
    {
      playerId: 2,
      role: "unknown",
      publicRole: "idiot",
      camp: "unknown",
      alive: true,
      isSheriff: false,
      isWinner: false,
    },
    { playerId: 3, role: "witch", camp: "wolf", alive: false, isSheriff: false, isWinner: false },
  ];
  const html = renderToStaticMarkup(
    <PlayerSeats
      players={players}
      locale="zh-CN"
      themeId="gothic-v1"
      tone="night"
      focusedPlayerId={null}
      onToggleFocus={() => {}}
      presentations={players.map((p) => ({
        playerId: p.playerId,
        seat: p.playerId,
        avatar: { kind: "symbol", key: "openai" } as const,
      }))}
    />,
  );
  const cards = html
    .split("<button")
    .slice(1)
    .map((s) => s.split("</button>")[0]!);
  expect(cards[0]).toContain('data-visible-role="unknown"');
  expect(cards[0]).toContain('data-role-color-key="neutral"');
  expect(cards[1]).toContain('data-role-color-key="ivory"');
  expect(cards[2]).toContain('data-role-color-key="amethyst"');
  expect(cards[2]).toContain("seat dead");
  expect(html.match(/data-avatar-key="openai"/g)).toHaveLength(3);
  expect(html).not.toContain("data-avatar-auto=");
});
