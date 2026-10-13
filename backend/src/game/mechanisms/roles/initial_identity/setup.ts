/**
 * 负责盗贼／变形者的初始选择 scope 与请求绑定。输入为原 World 参与者和首夜请求；输出保留原选择结果与请求绑定，仅在 setup 仍当前时写选择及接受的别名。失败选择与已关闭 setup 保留原终结决定；元数据不携带行动许可。
 */
import { createCampComponent } from "../../../observation/component-presentation";
import type {
  ReadonlyBoardConfig,
  ThiefState,
  ShapeshifterState,
} from "@ai-werewolf-arena/game-contract";
import { registerRequestAliasPropagation } from "../../../../core/domain/request_delivery";
import { copyEventData } from "@ai-werewolf-arena/game-contract";
import { COMPONENT, Camp, Phase, Role, createVictoryComponent, type ActionProvider, type ActionRequest, type CampComponent, type GameEvent, type RoleComponent, type VictoryComponent, type World } from "../../../../core/domain";
import { createRoleComponent } from "../../../observation/role-presentation";
import { GameActionRequestFactory } from "../../../engine/action_request_factory";
import { ToolGateway } from "../../../gateway/tool_gateway";
import { getDefaultRoleCatalog } from "../role-catalog-assembly";
import {
  captureDebateParticipant,
  sameDebateParticipant,
  type DebateParticipant,
} from "../debater/authority";
import {
  openInitialIdentitySetup,
  closeInitialIdentitySetup,
  hasActiveInitialIdentitySetup,
  initialIdentityStock,
  initialIdentitySetupStatus,
  initialIdentitySetupReady,
  readInitialIdentityCard,
  pendingInitialIdentityDealValid,
  selectInitialIdentityCard,
  type InitialIdentityCard,
  type InitialIdentityDeal,
  type InitialIdentitySlot,
} from "./deal";
import { dataField } from "../thief/state";
import {
  getInitialIdentityState,
  readInitialIdentityTool,
  initialIdentityPolicy,
  initialIdentityRole,
  initialIdentityTool,
  initialIdentityChoiceRule,
  type InitialIdentityState,
} from "./choice";
import { initialIdentityKind, type InitialIdentityKind } from "./deal";
interface CardScope {
  card: InitialIdentityCard;
  cardId: string;
  role: Role;
}
export interface InitialIdentityScope {
  world: World;
  kind: InitialIdentityKind;
  actorId: number;
  deal: InitialIdentityDeal;
  reserve: InitialIdentityDeal["reserve"];
  hands: Map<number, InitialIdentityCard>;
  cards: readonly [CardScope, CardScope];
  originalHand: InitialIdentityCard;
  participants: readonly DebateParticipant[];
  actor: DebateParticipant;
  state: InitialIdentityState;
  camp: CampComponent;
  victory: VictoryComponent;
  victoryJson: string;
  config: ReadonlyBoardConfig;
  configJson: string;
  isCurrent: () => boolean;
  required: boolean;
  allowedSlots: readonly InitialIdentitySlot[];
}
const scopes = new WeakMap<World, InitialIdentityScope>();
const requests = new WeakMap<
  ActionRequest,
  { scope: InitialIdentityScope; context: ActionRequest["context"] }
>();
function frozenJson(value: unknown): string | null {
  try {
    const copy = copyEventData(value);
    return copy === null ? null : JSON.stringify(copy);
  } catch {
    return null;
  }
}
function validCard(scope: CardScope): boolean {
  const card = readInitialIdentityCard(scope.card);
  return !!card && card.cardId === scope.cardId && card.role === scope.role;
}
export function sameInitialIdentityScope(scope: InitialIdentityScope): boolean {
  const { world, deal } = scope;
  const remaining = Object.getOwnPropertyDescriptor(scope.state, "remaining"),
    choice = Object.getOwnPropertyDescriptor(scope.state, "choice");
  const reserve0 = Object.getOwnPropertyDescriptor(scope.reserve, "0"),
    reserve1 = Object.getOwnPropertyDescriptor(scope.reserve, "1"),
    selection = Object.getOwnPropertyDescriptor(deal, "selection");
  return (
    scopes.get(world) === scope &&
    initialIdentityKind(world) === scope.kind &&
    hasActiveInitialIdentitySetup(world) &&
    initialIdentitySetupStatus(world) === "pending" &&
    scope.isCurrent() &&
    pendingInitialIdentityDealValid(world) &&
    initialIdentityStock(world) === deal &&
    dataField(deal, "hands") === scope.hands &&
    dataField(deal, "reserve") === scope.reserve &&
    scope.reserve.length === 2 &&
    [reserve0, reserve1].every((d) => d && Object.hasOwn(d, "value") && d.writable) &&
    reserve0!.value === scope.cards[0].card &&
    reserve1!.value === scope.cards[1].card &&
    scope.cards.every(validCard) &&
    scope.required ===
      initialIdentityChoiceRule(
        scope.kind,
        scope.cards.map((c) => c.role),
      ).mustChoose &&
    JSON.stringify(scope.allowedSlots) ===
      JSON.stringify(
        initialIdentityChoiceRule(
          scope.kind,
          scope.cards.map((c) => c.role),
        ).allowedSlots,
      ) &&
    Map.prototype.get.call(scope.hands, scope.actorId) === scope.originalHand &&
    scope.participants.length === world.entityIds().length &&
    scope.participants.every((p) => sameDebateParticipant(world, p)) &&
    getInitialIdentityState(scope.actor.role, scope.kind) === scope.state &&
    scope.state.policy === initialIdentityPolicy(scope.kind) &&
    remaining?.value === 1 &&
    remaining.writable === true &&
    choice?.value === null &&
    choice.writable === true &&
    world.getComponent(scope.actorId, COMPONENT.Camp) === scope.camp &&
    dataField(scope.camp, "camp") === Camp.Good &&
    world.getComponent(scope.actorId, COMPONENT.Victory) === scope.victory &&
    frozenJson(scope.victory) === scope.victoryJson &&
    frozenJson(scope.config) === scope.configJson &&
    selection?.value === null &&
    selection.writable === true
  );
}
export function authorizedInitialIdentityScope(
  world: World,
  actorId: number,
  day: number | undefined,
  phase: Phase,
  scope: object | undefined,
  kind: InitialIdentityKind,
): InitialIdentityScope | null {
  const active = scopes.get(world);
  return active &&
    active === scope &&
    active.kind === kind &&
    actorId === active.actorId &&
    day === 1 &&
    phase === Phase.Night &&
    sameInitialIdentityScope(active)
    ? active
    : null;
}
export function bindInitialIdentityRequest(world: World, request: ActionRequest): void {
  const scope = scopes.get(world);
  if (
    scope &&
    request.actorId === scope.actorId &&
    request.phase === Phase.Night &&
    request.context.day === 1 &&
    request.context.stage === scope.kind
  ) {
    requests.set(request, { scope, context: request.context });
    registerRequestAliasPropagation(request, 20, inheritInitialIdentityDeadlineRequest);
  }
}
export function initialIdentityRequestScope(
  world: World,
  request: ActionRequest,
): InitialIdentityScope | undefined {
  const binding = requests.get(request);
  return binding &&
    binding.scope.world === world &&
    scopes.get(world) === binding.scope &&
    request.actorId === binding.scope.actorId &&
    request.context === binding.context &&
    request.phase === Phase.Night &&
    request.context.day === 1 &&
    request.context.stage === binding.scope.kind
    ? binding.scope
    : undefined;
}
export function inheritInitialIdentityDeadlineRequest(
  source: ActionRequest,
  target: ActionRequest,
): void {
  const binding = requests.get(source);
  if (!binding || !initialIdentityRequestScope(binding.scope.world, source)) return;
  const keys = Object.keys(source).filter((k) => k !== "deadlineAtMs"),
    other = Object.keys(target).filter((k) => k !== "deadlineAtMs");
  if (
    keys.length !== other.length ||
    keys.some((k) => !other.includes(k) || (source as any)[k] !== (target as any)[k])
  )
    return;
  requests.set(target, binding);
  registerRequestAliasPropagation(target, 20, inheritInitialIdentityDeadlineRequest);
}
export function initialIdentityRequestChoices(
  world: World,
  actorId: number,
  kind: InitialIdentityKind,
) {
  const scope = scopes.get(world);
  if (
    !scope ||
    scope.kind !== kind ||
    scope.actorId !== actorId ||
    !sameInitialIdentityScope(scope)
  )
    return undefined;
  return {
    mustChoose: scope.required,
    allowedSlots: [...scope.allowedSlots],
    cards: scope.cards.map((card, slot) => ({
      slot: slot as InitialIdentitySlot,
      role: card.role,
    })),
  };
}
export class InitialIdentitySetupWindow {
  constructor(
    private readonly world: World,
    private readonly gateway: ToolGateway,
    private readonly events: GameEvent[],
    private readonly kind: InitialIdentityKind,
  ) {}
  async execute(
    config: ReadonlyBoardConfig,
    provider: ActionProvider,
    day: number,
    isCurrent: () => boolean,
  ): Promise<boolean> {
    if (initialIdentityKind(this.world) !== this.kind) return true;
    if (hasActiveInitialIdentitySetup(this.world)) throw new Error(`${this.kind}_setup_reentry`);
    if (initialIdentitySetupReady(this.world)) return true;
    if (day !== 1 || initialIdentitySetupStatus(this.world) !== "pending" || !isCurrent())
      throw new Error(`${this.kind}_setup_unavailable`);
    const deal = openInitialIdentitySetup(this.world);
    let status: "complete" | "cancelled" | "failed" = "failed";
    try {
      if (!pendingInitialIdentityDealValid(this.world)) {
        status = "cancelled";
        return false;
      }
      const actorIds = this.world
        .getAliveEntityIds()
        .filter(
          (id) =>
            this.world.getComponent(id, COMPONENT.Role)?.role === initialIdentityRole(this.kind),
        );
      if (actorIds.length === 0) {
        status = "complete";
        return true;
      }
      if (actorIds.length !== 1) throw new Error(`${this.kind}_actor_invalid`);
      const actorId = actorIds[0]!,
        actor = captureDebateParticipant(this.world, actorId),
        state = getInitialIdentityState(actor?.role, this.kind),
        camp = this.world.getComponent(actorId, COMPONENT.Camp),
        victory = this.world.getComponent(actorId, COMPONENT.Victory);
      const cards = deal.reserve.map((card) => {
        const data = readInitialIdentityCard(card);
        return data ? { card, ...data } : null;
      });
      const configJson = frozenJson(config),
        victoryJson = frozenJson(victory);
      if (
        !actor ||
        actor.camp !== Camp.Good ||
        !state ||
        !camp ||
        !victory ||
        cards.some((card) => !card) ||
        configJson === null ||
        victoryJson === null
      ) {
        status = "cancelled";
        return false;
      }
      const participants = this.world
        .entityIds()
        .map((id) => captureDebateParticipant(this.world, id));
      if (participants.some((p) => !p)) {
        status = "cancelled";
        return false;
      }
      const scope: InitialIdentityScope = {
        world: this.world,
        kind: this.kind,
        actorId,
        deal,
        reserve: deal.reserve,
        hands: deal.hands,
        cards: cards as [CardScope, CardScope],
        originalHand: deal.hands.get(actorId)!,
        participants: participants as DebateParticipant[],
        actor,
        state,
        camp,
        victory,
        victoryJson,
        config,
        configJson,
        isCurrent,
        required: initialIdentityChoiceRule(
          this.kind,
          cards.map((c) => c!.role),
        ).mustChoose,
        allowedSlots: initialIdentityChoiceRule(
          this.kind,
          cards.map((c) => c!.role),
        ).allowedSlots,
      };
      scopes.set(this.world, scope);
      if (!sameInitialIdentityScope(scope)) {
        status = "cancelled";
        return false;
      }
      const request = new GameActionRequestFactory(this.world, this.events, 1).create({
        phase: Phase.Night,
        actorId,
        allowedTools: [initialIdentityTool(this.kind)],
        stage: this.kind,
        requiresAction: scope.required,
        summary: {
          key:
            this.kind === "shapeshifter"
              ? "turn.shapeshifter.required"
              : scope.required
                ? "turn.thief.required"
                : "turn.thief.optional",
        },
        context: { allow_fallback: false, action_failure_policy: "error" },
      });
      if (!sameInitialIdentityScope(scope)) {
        status = "cancelled";
        return false;
      }
      const call = await provider.getAction(request);
      if (!sameInitialIdentityScope(scope)) {
        status = "cancelled";
        return false;
      }
      let slot: InitialIdentitySlot | null = null;
      if (call === null) {
        if (scope.required) throw new Error(`${this.kind}_required_choice_missing`);
      } else {
        const choiceCall = readInitialIdentityTool(call, this.kind);
        if (!choiceCall) throw new Error(`${this.kind}_choice_invalid`);
        const valid = this.gateway.validateAndSanitize(this.world, actorId, choiceCall, {
          phase: Phase.Night,
          day: 1,
          ...(this.kind === "thief" ? { thiefScope: scope } : { shapeshifterScope: scope }),
        });
        if (!sameInitialIdentityScope(scope)) {
          status = "cancelled";
          return false;
        }
        if (!valid.ok || !scope.allowedSlots.includes(choiceCall.args.slot))
          throw new Error(`${this.kind}_choice_invalid`);
        slot = choiceCall.args.slot;
      }
      const chosen = slot === null ? null : scope.cards[slot].card;
      const catalog = getDefaultRoleCatalog();
      const newRole = chosen
        ? createRoleComponent(chosen.role, catalog.getCamp(chosen.role), this.world.locale)
        : null;
      if (newRole)
        catalog.applyRuntime(newRole, {
          boardConfig: config,
          locale: this.world.locale,
          world: this.world,
        });
      const newCamp = newRole ? createCampComponent(newRole.camp, this.world.locale) : null;
      const newVictory = newRole
        ? createVictoryComponent([{ kind: "faction", faction: newRole.camp }])
        : null;
      if (!sameInitialIdentityScope(scope)) {
        status = "cancelled";
        return false;
      }
      // 物理交换与身份安装之间没有 await、Provider 回调或事件发表。
      if (chosen && slot !== null && newRole && newCamp && newVictory) {
        if (this.kind === "shapeshifter") {
          (state as Pick<ThiefState | ShapeshifterState, "remaining">).remaining = 0;
          (state as Pick<ThiefState | ShapeshifterState, "choice">).choice = slot;
        }
        selectInitialIdentityCard(this.world, actorId, slot);
        this.world.addComponent(actorId, COMPONENT.Role, newRole);
        this.world.addComponent(actorId, COMPONENT.Camp, newCamp);
        this.world.addComponent(actorId, COMPONENT.Victory, newVictory);
      } else {
        (state as Pick<ThiefState | ShapeshifterState, "remaining">).remaining = 0;
        (state as Pick<ThiefState | ShapeshifterState, "choice">).choice = null;
        selectInitialIdentityCard(this.world, actorId, null);
      }
      status = "complete";
      closeInitialIdentitySetup(this.world, status);
      scopes.delete(this.world);
      const data = {
        actorId,
        day: 1 as const,
        role: newRole?.role ?? initialIdentityRole(this.kind),
        camp: newRole?.camp ?? Camp.Good,
      };
      this.events.push(
        this.kind === "shapeshifter"
          ? {
              timestamp: Date.now(),
              type: "shapeshifter_identity_chosen",
              payload: {
                ...data,
                slot: slot!,
                policy: "awa_netease_shapeshifter_two_extra_villagers_v1",
              },
            }
          : {
              timestamp: Date.now(),
              type: "thief_identity_chosen",
              payload: { ...data, slot, policy: "lui_meme_thief_two_extra_villagers_v1" },
            },
      );
      return true;
    } finally {
      if (this.kind === "shapeshifter" && status !== "complete") {
        const original =
          scopes.get(this.world)?.state ??
          this.world
            .entityIds()
            .map((id) =>
              getInitialIdentityState(this.world.getComponent(id, COMPONENT.Role), this.kind),
            )
            .find(Boolean);
        if (
          original &&
          Object.getOwnPropertyDescriptor(original, "remaining")?.writable &&
          Object.getOwnPropertyDescriptor(original, "choice")?.writable
        ) {
          (original as Pick<ThiefState | ShapeshifterState, "remaining">).remaining = 0;
          (original as Pick<ThiefState | ShapeshifterState, "choice">).choice = null;
        }
      }
      scopes.delete(this.world);
      closeInitialIdentitySetup(this.world, status);
    }
  }
}
