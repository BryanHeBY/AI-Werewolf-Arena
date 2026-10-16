/**
 * 为已有字面机制文案补上冻结夹具中的昵称，独立于生产模板插值器。
 * 仅用于测试预期：原编号文案仍由各测试单独断言，不修改录制夹具或实际画面。
 */
export function withPlayerNames(
  literal: string,
  players: readonly { player_id: number; name?: string }[],
  locale: "zh-CN" | "en",
): string {
  const names = new Map(players.map((player) => [player.player_id, player.name]));
  return literal.replace(
    /([Pp]layer |White Wolf King |Wolf King |Wolf Beauty |Gargoyle |Hidden Wolf |Hunter |Knight |Gravekeeper |original caster |选择|chose )(\d+)(?:号)?|(\d+)号(?:玩家)?/g,
    (original, prefix: string | undefined, english: string, chinese: string) => {
      const id = Number(english ?? chinese),
        name = names.get(id);
      const before = prefix && !/^[Pp]layer $/.test(prefix) ? prefix : "";
      return name
        ? `${before}${locale === "zh-CN" ? `${id}号` : `Player ${id}`}·${name}`
        : original;
    },
  );
}
