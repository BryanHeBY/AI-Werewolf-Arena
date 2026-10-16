/**
 * 负责从复盘编号与显式展示配置解析稳定玩家名册。输入只读取编号、座次和可选名称，输出纯 JSON 的座次、展示名、模型标签及头像引用。
 * 消费者为网页席位、视频计划和统一系统文案；角色、阵营、发言和私有接入配置不进入本 API，缺省沿用原编号，匿名不会从模型、昵称或发言反推头像。
 */
export const AVATAR_KEYS = [
  "neutral",
  "openai",
  "anthropic",
  "deepseek",
  "gemini",
  "qwen",
  "doubao",
  "kimi",
  "glm",
] as const;
export type AvatarKey = (typeof AVATAR_KEYS)[number];
export type PlayerAvatar =
  { kind: "symbol"; key: AvatarKey } | { kind: "asset"; assetId: string } | { kind: "none" };
export interface PlayerPresentationOverride {
  seat?: number;
  displayName?: string;
  modelLabel?: string;
  avatarKey?: AvatarKey;
  avatarAssetId?: string;
  showName?: boolean;
  showModel?: boolean;
  showAvatar?: boolean;
}
export interface PlayerPresentationConfig {
  anonymous?: boolean;
  showNames?: boolean;
  showModels?: boolean;
  showAvatars?: boolean;
  players?: Record<string, PlayerPresentationOverride>;
}
export interface PlayerPresentationSource {
  player_id: number;
  seat?: number;
  name?: string;
  model?: string;
}
export interface ResolvedPlayerPresentation {
  playerId: number;
  seat: number;
  displayName?: string;
  modelLabel?: string;
  avatar: PlayerAvatar;
}
const fields = [
  "seat",
  "displayName",
  "modelLabel",
  "avatarKey",
  "avatarAssetId",
  "showName",
  "showModel",
  "showAvatar",
];
function fail(reason: string): never {
  throw new Error(`player_presentation_${reason}`);
}
function plain(value: unknown): value is Record<string, unknown> {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)
  );
}
function entries(value: unknown, allowed: readonly string[]): [string, unknown][] {
  if (!plain(value)) fail("invalid");
  return Object.keys(value).map((key) => {
    const field = Object.getOwnPropertyDescriptor(value, key)!;
    if (!allowed.includes(key) || !("value" in field)) fail("field_invalid");
    return [key, field.value];
  });
}
function positive(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}
export function parsePlayerPresentationConfig(value: unknown): PlayerPresentationConfig {
  const result: PlayerPresentationConfig = {};
  for (const [key, option] of entries(value, [
    "anonymous",
    "showNames",
    "showModels",
    "showAvatars",
    "players",
  ])) {
    if (key !== "players") {
      if (typeof option !== "boolean") fail("visibility_invalid");
      Object.assign(result, { [key]: option });
      continue;
    }
    if (!plain(option)) fail("players_invalid");
    const players: Record<string, PlayerPresentationOverride> = {};
    for (const id of Object.keys(option)) {
      if (!/^[1-9]\d*$/.test(id) || !positive(Number(id))) fail("player_id_invalid");
      const field = Object.getOwnPropertyDescriptor(option, id)!;
      if (!("value" in field)) fail("field_invalid");
      const player: PlayerPresentationOverride = {};
      for (const [name, raw] of entries(field.value, fields)) {
        if (name === "seat") {
          if (!positive(raw)) fail("seat_invalid");
        } else if (name.startsWith("show")) {
          if (typeof raw !== "boolean") fail("visibility_invalid");
        } else if (name === "avatarKey") {
          if (!AVATAR_KEYS.includes(raw as AvatarKey)) fail("avatar_invalid");
        } else if (typeof raw !== "string" || (name === "avatarAssetId" && !raw.trim()))
          fail("text_invalid");
        Object.assign(player, { [name]: raw });
      }
      if (player.avatarKey !== undefined && player.avatarAssetId !== undefined)
        fail("avatar_conflict");
      players[id] = player;
    }
    result.players = players;
  }
  return result;
}
export function resolvePlayerPresentations(
  sources: readonly PlayerPresentationSource[],
  configuration: PlayerPresentationConfig = {},
): ResolvedPlayerPresentation[] {
  const config = parsePlayerPresentationConfig(configuration);
  const ids = new Set<number>();
  const seats = new Set<number>();
  const result = sources.map((source) => {
    // 白名单投影不展开源对象；外部追加的 role、camp、avatar 一律不作为展示资料来源；明确 model 只作为可隐藏标签。
    const idField = Object.getOwnPropertyDescriptor(source, "player_id");
    const seatField = Object.getOwnPropertyDescriptor(source, "seat");
    const nameField = Object.getOwnPropertyDescriptor(source, "name");
    const modelField = Object.getOwnPropertyDescriptor(source, "model");
    if (!idField || !("value" in idField) || !positive(idField.value) || ids.has(idField.value))
      fail("player_id_invalid");
    if (seatField && (!("value" in seatField) || !positive(seatField.value))) fail("seat_invalid");
    if (
      nameField &&
      (!("value" in nameField) ||
        (nameField.value !== undefined && typeof nameField.value !== "string"))
    )
      fail("text_invalid");
    if (
      modelField &&
      (!("value" in modelField) ||
        (modelField.value !== undefined && typeof modelField.value !== "string"))
    )
      fail("text_invalid");
    const playerId = idField.value as number;
    ids.add(playerId);
    const override = config.players?.[String(playerId)] ?? {};
    if (seatField && override.seat !== undefined && override.seat !== seatField.value)
      fail("seat_conflict");
    const seat = (seatField?.value ?? override.seat ?? playerId) as number;
    if (seats.has(seat)) fail("seat_duplicate");
    seats.add(seat);
    const displayName = override.displayName ?? nameField?.value;
    const modelLabel = override.modelLabel ?? modelField?.value;
    const anonymous = config.anonymous === true;
    const showName = !anonymous && config.showNames !== false && override.showName !== false;
    const showModel = !anonymous && config.showModels !== false && override.showModel !== false;
    const showAvatar = config.showAvatars !== false && override.showAvatar !== false;
    const avatar: PlayerAvatar = !showAvatar
      ? { kind: "none" }
      : anonymous
        ? { kind: "symbol", key: "neutral" }
        : override.avatarAssetId
          ? { kind: "asset", assetId: override.avatarAssetId }
          : { kind: "symbol", key: override.avatarKey ?? "neutral" };
    return {
      playerId,
      seat,
      ...(showName && displayName ? { displayName } : {}),
      ...(showModel && modelLabel ? { modelLabel } : {}),
      avatar,
    };
  });
  for (const id of Object.keys(config.players ?? {}))
    if (!ids.has(Number(id))) fail("player_missing");
  return result.sort((left, right) => left.seat - right.seat);
}
/** 系统文案统一使用这份已裁剪名单；玩家发言正文仍保持原归档，不在此替换字符串。 */
export function presentationPlayers(players: readonly ResolvedPlayerPresentation[]) {
  return players.map((player) => ({
    id: player.playerId,
    seat: player.seat,
    ...(player.displayName === undefined ? {} : { name: player.displayName }),
  }));
}
