/**
 * 负责角色贡献的静态完整程序身份与实际公开值查询边界。输入是原 callback／原参数，输出保原结果。
 * 内建原程序私持 World、角色与 Camp 引用；未知扩展只得具体值／脱离数据查询，init 仅可写原 ownRole 和 initialCamp。
 * 私表只存函数与贡献种类，不存 World、角色索引、局状态或第二份许可。方法转发保原 receiver 和实际 getter 时点。
 * 不新增运行冻结，不把 readonly 组件当窄查询；外来候选任意对象图不由此工具沙箱化。
 */
import {
  type Camp,
  type EntityId,
  type Role,
  type VictoryAffiliation,
  type Locale,
  type NativeRolePresentationId,
} from "@ai-werewolf-arena/game-contract";
import { snapshotPlainData } from "../../domain/plain-data";
import { COMPONENT } from "../../domain/components/names";
import type { RoleComponent } from "../../domain/components/role";
import type { CurrentCampSource } from "../../domain/components/camp";
import type { World } from "../../domain/world";
import type { ActionRequest, ToolCall } from "../../domain/actions";
import type {
  RoleInitContext,
  RoleValueContext,
  RoleInitializationComponent,
  RoleQueries,
  RoleRuntimeContribution,
  RoleProfile,
  WolfTeamPermissions,
} from "./contracts";

/** 仅可信装配持有原初始化输入；公共 ctx 明确没有 World，currentCamp 只给枚举值。 */
export interface OwnedRoleInitContext extends Omit<RoleInitContext, "queries" | "currentCamp"> {
  readonly world?: World;
  readonly currentCamp: CurrentCampSource;
}
type Participation = { canVote: boolean; canBeExiled: boolean; canBeSheriff: boolean };
type InspectionLabels = {
  camp?: import("@ai-werewolf-arena/game-contract").InspectionCamp;
  role?: import("@ai-werewolf-arena/game-contract").RoleId;
};
export interface OwnedRoleCallbacks {
  init: (role: RoleInitializationComponent, ctx: OwnedRoleInitContext) => void;
  initialVictoryAffiliations: (
    role: RoleComponent,
    ctx: OwnedRoleInitContext,
  ) => readonly VictoryAffiliation[];
  participation: (
    role: RoleComponent,
    world?: World,
    currentCamp?: CurrentCampSource,
  ) => Participation;
  wolfTeam: (
    role: RoleComponent,
    world: World | undefined,
    currentCamp: CurrentCampSource,
  ) => WolfTeamPermissions;
  knownTeammates: (
    role: RoleComponent,
    world: World,
    currentCamp: CurrentCampSource,
  ) => readonly number[];
  detectableByBear: (world: World, role: RoleComponent, currentCamp: CurrentCampSource) => boolean;
  canSelfDestruct: (role: RoleComponent, currentCamp: CurrentCampSource, world?: World) => boolean;
  inspectionLabels: (
    role: RoleComponent,
    world?: World,
    currentCamp?: CurrentCampSource,
  ) => InspectionLabels;
  baselineAction: (
    role: RoleComponent,
    request: ActionRequest,
    pick: () => number | null,
    pickCamp: (camp: "good" | "wolf" | "third_party") => number | null,
    locale: Locale | undefined,
    world: World | undefined,
    currentCamp: CurrentCampSource,
  ) => ToolCall | null;
  renderPrompt: (
    role: RoleComponent,
    locale: Locale | undefined,
    world: World | undefined,
    currentCamp: CurrentCampSource,
  ) => string;
  renderNative: (
    id: NativeRolePresentationId,
    role: RoleComponent,
    locale: Locale,
    world: World | undefined,
    currentCamp: CurrentCampSource,
  ) => string;
}
type PublicCallbacks = RoleRuntimeContribution &
  Pick<RoleProfile, "renderPrompt"> & {
    renderNative: (id: NativeRolePresentationId, queries: RoleQueries, locale: Locale) => string;
  };
type Kind = keyof OwnedRoleCallbacks;
const definitions = new WeakMap<object, Set<Kind>>();
/** 具名冷声明保原属性推断 name／length 和同一完整函数；只登记函数＋种类，不保声明对象。 */
export function ownRoleCallback<K extends Kind>(
  kind: K,
  program: Pick<OwnedRoleCallbacks, K>,
): NonNullable<PublicCallbacks[K]>;
export function ownRoleCallback<K extends Kind>(
  kind: K,
  program: { [P in K]: OwnedRoleCallbacks[P] | Exclude<PublicCallbacks[P], Function> },
): PublicCallbacks[K];
export function ownRoleCallback(kind: Kind, program: Partial<Record<Kind, unknown>>): unknown {
  const value = program[kind];
  if (typeof value === "function") {
    const kinds = definitions.get(value) ?? new Set<Kind>();
    kinds.add(kind);
    definitions.set(value, kinds);
  }
  return value;
}

/** 每次调用的闭包只给具体值。私态按原深数据工具在调用时复制，容纳实际能力元数据／状态／历史层级。
 * snapshotPlainData 拒绝 getter、Proxy、循环及深度／数组超限；其错误向调用方传播，不提前读取或回退空私态。
 * structuredClone 只消费已确认的数据快照，恢复普通可写副本；既不冻结原体，也不把能力别名／组件引用当新许可。
 */
export function roleQueries(
  role: RoleComponent,
  worldSource?: () => World | undefined,
  currentCamp?: CurrentCampSource,
): RoleQueries {
  return {
    actorRole: () => role.role,
    stateData: () => structuredClone(snapshotPlainData(role.privateState, new Set(), 0, 65536)),
    currentCamp: () => currentCamp?.()?.camp,
    entityIds: () => worldSource?.()?.entityIds() ?? [],
    aliveIds: () => worldSource?.()?.getAliveEntityIds() ?? [],
    roleValue: (id: EntityId) => worldSource?.()?.getComponent(id, COMPONENT.Role)?.role,
    campValue: (id: EntityId) => worldSource?.()?.getComponent(id, COMPONENT.Camp)?.camp,
    isAlive: (id: EntityId) => worldSource?.()?.getComponent(id, COMPONENT.Alive)?.alive === true,
  };
}
function publicInitContext(role: RoleComponent, host: OwnedRoleInitContext): RoleInitContext {
  return {
    get initialCamp() {
      return host.initialCamp;
    },
    get currentCamp() {
      return () => host.currentCamp()?.camp;
    },
    get locale() {
      return host.locale;
    },
    get boardConfig() {
      return host.boardConfig;
    },
    queries: roleQueries(
      role,
      () => host.world,
      () => host.currentCamp(),
    ),
  };
}
/** 归属声明不是初始化写端口：只投影晚读值，不把 initialCamp 或宿主本身交给未知函数。 */
function publicValueContext(host: OwnedRoleInitContext): RoleValueContext {
  return {
    get currentCamp() {
      return () => host.currentCamp()?.camp;
    },
    get locale() {
      return host.locale;
    },
    get boardConfig() {
      return host.boardConfig;
    },
  };
}
/** 原参数已求值后才分可信程序／未知扩展；只有 init 明确保留原 ownRole 和 initialCamp 写权。 */
export function invokeRoleCallback<K extends Kind>(
  kind: K,
  callback: Function,
  receiver: unknown,
  ...args: Parameters<OwnedRoleCallbacks[K]>
): ReturnType<OwnedRoleCallbacks[K]> {
  if (definitions.get(callback)?.has(kind)) return Reflect.apply(callback, receiver, args);
  let input: unknown[];
  if (kind === "init" || kind === "initialVictoryAffiliations") {
    const [role, context] = args as Parameters<OwnedRoleCallbacks["init"]>;
    input =
      kind === "init"
        ? [role, publicInitContext(role, context)]
        : [
            roleQueries(
              role,
              () => context.world,
              () => context.currentCamp(),
            ),
            publicValueContext(context),
          ];
  } else if (kind === "detectableByBear") {
    const [world, role, source] = args as Parameters<OwnedRoleCallbacks["detectableByBear"]>;
    input = [roleQueries(role, () => world, source)];
  } else if (kind === "wolfTeam") {
    const [role, world, source] = args as Parameters<OwnedRoleCallbacks["wolfTeam"]>;
    input = [roleQueries(role, () => world, source)];
  } else if (kind === "knownTeammates") {
    const [role, world, source] = args as Parameters<OwnedRoleCallbacks["knownTeammates"]>;
    input = [roleQueries(role, () => world, source)];
  } else if (kind === "canSelfDestruct") {
    const [role, source, world] = args as Parameters<OwnedRoleCallbacks["canSelfDestruct"]>;
    input = [roleQueries(role, () => world, source)];
  } else if (kind === "baselineAction") {
    const [role, request, pick, pickCamp, locale, world, source] = args as Parameters<
      OwnedRoleCallbacks["baselineAction"]
    >;
    input = [roleQueries(role, () => world, source), request, pick, pickCamp, locale];
  } else if (kind === "renderPrompt") {
    const [role, locale, world, source] = args as Parameters<OwnedRoleCallbacks["renderPrompt"]>;
    input = [roleQueries(role, () => world, source), locale];
  } else if (kind === "renderNative") {
    const [id, role, locale, world, source] = args as Parameters<
      OwnedRoleCallbacks["renderNative"]
    >;
    input = [id, roleQueries(role, () => world, source), locale];
  } else {
    // 参与资格与查验标签同样消费调用点的晚查询，不能因回调种类而丢弃已知 World／Camp。
    const [role, world, source] = args as Parameters<OwnedRoleCallbacks["participation"]>;
    input = [roleQueries(role, () => world, source)];
  }
  return Reflect.apply(callback, receiver, input);
}
/** 显式泛型调用签名表达同一种类的参数／返回值；不把所有种类的函数强交叉断言为单一成员。 */
type OwnedRoleMethod<K extends Kind> = (
  ...args: Parameters<OwnedRoleCallbacks[K]>
) => ReturnType<OwnedRoleCallbacks[K]>;

/** 保原对象的晚字段读取；只有原 owner optional-chain 才跳过空 owner，非函数值不在准备时提前抛错。 */
export function roleMethod<K extends Kind>(
  owner: object | undefined,
  kind: K,
  optionalOwner = false,
): OwnedRoleMethod<K> | undefined {
  if (optionalOwner && owner == null) return undefined;
  const callback = (owner as Record<string, unknown>)[kind];
  if (typeof callback !== "function") return callback as OwnedRoleMethod<K> | undefined;
  return (...args: Parameters<OwnedRoleCallbacks[K]>) =>
    invokeRoleCallback(kind, callback, owner, ...args);
}
