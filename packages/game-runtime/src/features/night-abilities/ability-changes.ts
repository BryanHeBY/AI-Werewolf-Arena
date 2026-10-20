/**
 * 负责普通原生夜能力完整 payload 准备与具体 kind 政策分派。
 * 输入为原角色、kind 与状态；输出保留原复制／族 reader 接受集合，并交唯一库存 owner 安装。
 * Pair 原角色限制先于数据复制；七种 payload 的准备分支、callee 和异常仍在原位置执行。
 * 本模块不直接写字典或通用 metadata；瓶数／历史和借用／原体／生命许可继续由各具体权威负责。
 * 准备失败不创建库存，实际安装失败保库存 owner 的既有前缀；不补退款或新的 schema。
 */
import type {
  NightAbilityKind,
  NightAbilityStates,
  NightAbilityReadState,
  RoleInspectionState,
} from "@ai-werewolf-arena/game-contract";

import type { RoleComponent } from "../../domain/components/role";
import { Role } from "../../domain/model";
import { projectPairState, copyAbilityData, commitPreparedNativeAbility } from "./abilities";

import { DREAMER_STATE_SLOT } from "../dreamer/ports";
import { SHELTER_STATE_SLOT } from "../radiant-eclipse/shelter-slot-ports";
import { SEER_STATE_SLOT } from "../seer/ports";
import { GUARD_STATE_SLOT } from "../guard/ports";
import { WITCH_STATE_SLOT } from "../witch/ports";
import { ROLE_INSPECTION_STATE_SLOT } from "../role-inspection/ports";

/** 原生安装先完成原 copy／policy，再写实际 abilities 槽；不提前读取退休 ID 或更换私有容器。 */
export function installNativeAbility<K extends NightAbilityKind>(
  role: RoleComponent,
  kind: K,
  state: NightAbilityStates[K],
): NightAbilityReadState<K>;
export function installNativeAbility<K extends NightAbilityKind>(
  role: RoleComponent,
  kind: K,
  state: NightAbilityStates[K],
  mayCommit: () => boolean,
): NightAbilityReadState<K> | null;
export function installNativeAbility<K extends NightAbilityKind>(
  role: RoleComponent,
  kind: K,
  state: NightAbilityStates[K],
  mayCommit?: () => boolean,
): NightAbilityReadState<K> | null {
  if (kind === "pair_check" && role.role !== Role.AwakenedSeer)
    throw Error("ability_pair_native_role_invalid");
  const ownedState = (
    kind === "pair_check"
      ? copyAbilityData(projectPairState(state))
      : kind === "role_check"
        ? ROLE_INSPECTION_STATE_SLOT.create(state as RoleInspectionState)
        : kind === "seer_check"
          ? SEER_STATE_SLOT.create(state as NightAbilityStates["seer_check"])
          : kind === "guard"
            ? GUARD_STATE_SLOT.create(state as NightAbilityStates["guard"])
            : kind === "potion"
              ? WITCH_STATE_SLOT.create(state as NightAbilityStates["potion"])
              : kind === "dream"
                ? DREAMER_STATE_SLOT.create(state as NightAbilityStates["dream"])
                : kind === "shelter"
                  ? SHELTER_STATE_SLOT.prepare(state as NightAbilityStates["shelter"])
                  : copyAbilityData(state)
  ) as NightAbilityStates[K];
  // 只有本次未付镜像显式传捕获拒绝回调；原七种准备／三参返回与失败顺序保持。
  return mayCommit
    ? commitPreparedNativeAbility(role, kind, ownedState, mayCommit)
    : commitPreparedNativeAbility(role, kind, ownedState);
}
