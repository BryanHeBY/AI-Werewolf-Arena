/**
 * 单元组件测试负责自动头像的许可边界、显式优先级与64角色登记复用。输入为手写头像和当前可见角色，输出独立DOM与纯JSON断言。
 * 不从归档最终底牌或代理名称生成预期，不下载素材；真实材质与字号另由实际PNG交叉检查。
 */
import { expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ROLE_IDS } from "@ai-werewolf-arena/game-contract";
import { IdentityAvatar } from "../../../src/presentation/IdentityAvatar";
import { resolvePlayerPresentations, visibleIdentityRole } from "../../../src/presentation";
import { PlayerAvatar } from "../../../src/video/render/broadcast/PlayerVisual";
import { PlayerSeats } from "../../../src/replay/PlayerSeats";

test("new defaults remain auto while explicit neutral, hidden and named LLM remain distinct", () => {
  const source = [{ player_id: 1, model: "openai", role: "wolf" }];
  expect(resolvePlayerPresentations(source)[0]!.avatar).toEqual({ kind: "auto" });
  expect(
    resolvePlayerPresentations(source, { players: { "1": { avatarKey: "neutral" } } })[0]!.avatar,
  ).toEqual({ kind: "symbol", key: "neutral" });
  expect(resolvePlayerPresentations(source, { showAvatars: false })[0]!.avatar).toEqual({
    kind: "none",
  });
  expect(
    resolvePlayerPresentations(source, { players: { "1": { avatarKey: "openai" } } })[0]!.avatar,
  ).toEqual({ kind: "symbol", key: "openai" });
  const anonymous = resolvePlayerPresentations(source, {
    anonymous: true,
    players: { "1": { avatarKey: "openai" } },
  });
  expect(anonymous).toEqual([{ playerId: 1, seat: 1, avatar: { kind: "auto" } }]);
});

test("all formal auto glyphs share a material carrier; unknown identity cannot reveal a future role", () => {
  for (const role of ROLE_IDS) {
    const html = renderToStaticMarkup(
      <IdentityAvatar avatar={{ kind: "auto" }} themeId="gothic-v1" visibleRole={role} size={76} />,
    );
    expect(html).toContain(`data-identity-role="${role}"`);
    expect(html).toContain("identity-medallion-v1.png");
    expect(html).not.toContain("data-avatar-key");
  }
  for (const role of ["unknown", "toString", "__proto__"]) {
    const html = renderToStaticMarkup(
      <IdentityAvatar avatar={{ kind: "auto" }} themeId="gothic-v1" visibleRole={role} />,
    );
    expect(html).toContain('data-avatar-auto="unknown"');
    expect(html).not.toContain("data-identity-role");
  }
  expect(visibleIdentityRole({ role: "unknown" })).toBe("unknown");
  expect(visibleIdentityRole({ role: "unknown", publicRole: "idiot" })).toBe("idiot");
  expect(visibleIdentityRole({ role: "witch", publicRole: "idiot" })).toBe("witch");
});

test("old neutral and explicit none never become role portraits; prepared video assets retain their base", () => {
  const old = { kind: "symbol", key: "neutral" } as const;
  const neutral = renderToStaticMarkup(
    <IdentityAvatar avatar={old} visibleRole="wolf" themeId="gothic-v1" />,
  );
  expect(neutral).toContain('data-avatar-key="neutral"');
  expect(neutral).not.toContain("identity-medallion");
  expect(
    renderToStaticMarkup(<IdentityAvatar avatar={{ kind: "none" }} visibleRole="wolf" />),
  ).toBe("");
  const profile = { playerId: 1, seat: 1, avatar: { kind: "asset", assetId: "avatar" } as const };
  const html = renderToStaticMarkup(
    <PlayerAvatar
      player={profile}
      visibleRole="wolf"
      themeId="gothic-v1"
      size={76}
      media={[{ id: "avatar", kind: "image", src: "media/avatar.png" }]}
      mediaBaseUrl="https://example.test/prepared/"
    />,
  );
  expect(html).toContain('src="https://example.test/prepared/media/avatar.png"');
  expect(html).not.toContain("data-identity-role");
  expect(old).toEqual({ kind: "symbol", key: "neutral" });
});

test("Web uses only supplied prepared image mapping and the same current-role policy", () => {
  const players = [
    {
      playerId: 1,
      role: "unknown",
      camp: "unknown",
      alive: false,
      isSheriff: false,
      isWinner: true,
    },
  ];
  const presentations = [
    { playerId: 1, seat: 1, avatar: { kind: "asset", assetId: "approved" } as const },
  ];
  const html = renderToStaticMarkup(
    <PlayerSeats
      players={players}
      presentations={presentations}
      themeId="gothic-v1"
      avatarSources={{ approved: "/prepared/approved.png" }}
      locale="en"
      focusedPlayerId={null}
      onToggleFocus={() => {}}
    />,
  );
  expect(html).toContain('src="/prepared/approved.png"');
  expect(html).toContain('data-eliminated-stamp="gothic-v1"');
  expect(html).toContain('class="winner"');
  expect(html).toContain('title="Unknown"');
  const missing = renderToStaticMarkup(
    <PlayerSeats
      players={players}
      presentations={presentations}
      themeId="gothic-v1"
      avatarSources={Object.create({ approved: "/unapproved.png" })}
      locale="en"
      focusedPlayerId={null}
      onToggleFocus={() => {}}
    />,
  );
  expect(missing).not.toContain("unapproved.png");
});
