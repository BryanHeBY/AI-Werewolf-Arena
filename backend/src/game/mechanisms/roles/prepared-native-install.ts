/**
 * 负责已经完成原复制与族政策验证的原生能力实际安装。输入为原角色、kind 和已准备状态；
 * 输出保留原实例／state 引用、退休 ID 修订与 metadata。按原顺序先取 privateState abilities，
 * 再读退休列表，检查来源绑定后替换 state 或安装新实例，source.role 仍在原写入点读取。
 * 本 owner 只写同一实际库存与原 metadata 默认值，不复制 state、推进阶段／业务时钟或授予请求；不创建第二存储。
 */
import type { NightAbilityKind, NightAbilityStates, NightAbilityReadState } from "@ai-werewolf-arena/game-contract";
import type { RoleComponent } from "../../../core/domain/components/role";
import type { NightAbility } from "./abilities";

export function commitPreparedNativeAbility<K extends NightAbilityKind>(
  role: RoleComponent,
  kind: K,
  ownedState: NightAbilityStates[K],
): NightAbilityReadState<K> {
  const stored = ((role.privateState as { abilities?: Record<string, NightAbility> }).abilities ??=
    {}) as Record<string, NightAbility>;
  const retired = ((role.privateState as { readonly retiredAbilityIds?: unknown })
    .retiredAbilityIds ?? []) as string[];
  const baseId = `native:${kind}`;
  let id = baseId,
    revision = 1;
  while (retired.includes(id)) id = `${baseId}:${++revision}`;
  const existing = stored[id];
  if (existing) {
    if (
      existing.kind !== kind ||
      existing.source.kind !== "native" ||
      existing.source.role !== role.role
    )
      throw new Error("ability_native_binding_conflict");
    existing.state = ownedState;
  } else {
    stored[id] = {
      id,
      kind,
      state: ownedState,
      source: { kind: "native", role: role.role },
      sourceDisclosed: true,
      startsOnDay: 1,
      maxUses: null,
      uses: 0,
      lastUsedDay: null,
      disabled: false,
    } as NightAbility;
  }
  return ownedState as NightAbilityReadState<K>;
}
