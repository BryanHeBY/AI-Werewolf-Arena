import { copyEventData } from "@ai-werewolf-arena/game-text";
import {
  COMPONENT,
  Camp,
  Phase,
  Role,
  createRoleComponent,
  createCampComponent,
  createVictoryComponent,
  type ActionProvider,
  type ActionRequest,
  type BoardConfig,
  type CampComponent,
  type GameEvent,
  type RoleComponent,
  type VictoryComponent,
  type World,
} from "../../../../core/domain";
import { GameActionRequestFactory } from "../../../engine/action_request_factory";
import { ToolGateway } from "../../../gateway/tool_gateway";
import { getDefaultRoleCatalog } from "../catalog";
import {
  captureDebateParticipant,
  sameDebateParticipant,
  type DebateParticipant,
} from "../debater/authority";
import {
  openThiefSetup,
  closeThiefSetup,
  hasActiveThiefSetup,
  thiefDeal,
  thiefSetupStatus,
  thiefSetupReady,
  readThiefCard,
  pendingThiefDealValid,
  selectThiefCard,
  type ThiefCard,
  type ThiefDeal,
  type ThiefSlot,
} from "./deal";
import { dataField, getThiefState, readThiefTool, THIEF_POLICY, type ThiefState } from "./state";
interface CardScope {
  card: ThiefCard;
  cardId: string;
  role: Role;
}
export interface ThiefScope {
  world: World;
  actorId: number;
  deal: ThiefDeal;
  reserve: ThiefDeal["reserve"];
  hands: Map<number, ThiefCard>;
  cards: readonly [CardScope, CardScope];
  originalHand: ThiefCard;
  participants: readonly DebateParticipant[];
  actor: DebateParticipant;
  state: ThiefState;
  camp: CampComponent;
  victory: VictoryComponent;
  victoryJson: string;
  config: BoardConfig;
  configJson: string;
  isCurrent: () => boolean;
  required: boolean;
}
const scopes = new WeakMap<World, ThiefScope>();
const requests = new WeakMap<
  ActionRequest,
  { scope: ThiefScope; context: ActionRequest["context"] }
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
  const card = readThiefCard(scope.card);
  return !!card && card.cardId === scope.cardId && card.role === scope.role;
}
export function sameThiefScope(scope: ThiefScope): boolean {
  const { world, deal } = scope;
  const remaining = Object.getOwnPropertyDescriptor(scope.state, "remaining"),
    choice = Object.getOwnPropertyDescriptor(scope.state, "choice");
  const reserve0 = Object.getOwnPropertyDescriptor(scope.reserve, "0"),
    reserve1 = Object.getOwnPropertyDescriptor(scope.reserve, "1"),
    selection = Object.getOwnPropertyDescriptor(deal, "selection");
  return (
    scopes.get(world) === scope &&
    hasActiveThiefSetup(world) &&
    thiefSetupStatus(world) === "pending" &&
    scope.isCurrent() &&
    pendingThiefDealValid(world) &&
    thiefDeal(world) === deal &&
    dataField(deal, "hands") === scope.hands &&
    dataField(deal, "reserve") === scope.reserve &&
    scope.reserve.length === 2 &&
    [reserve0, reserve1].every((d) => d && Object.hasOwn(d, "value") && d.writable) &&
    reserve0!.value === scope.cards[0].card &&
    reserve1!.value === scope.cards[1].card &&
    scope.cards.every(validCard) &&
    Map.prototype.get.call(scope.hands, scope.actorId) === scope.originalHand &&
    scope.participants.length === world.entityIds().length &&
    scope.participants.every((p) => sameDebateParticipant(world, p)) &&
    getThiefState(scope.actor.role) === scope.state &&
    scope.state.policy === THIEF_POLICY &&
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
export function authorizedThiefScope(
  world: World,
  actorId: number,
  day: number | undefined,
  phase: Phase,
  scope: object | undefined,
): ThiefScope | null {
  const active = scopes.get(world);
  return active &&
    active === scope &&
    actorId === active.actorId &&
    day === 1 &&
    phase === Phase.Night &&
    sameThiefScope(active)
    ? active
    : null;
}
export function bindThiefRequest(world: World, request: ActionRequest): void {
  const scope = scopes.get(world);
  if (
    scope &&
    request.actorId === scope.actorId &&
    request.phase === Phase.Night &&
    request.context.day === 1 &&
    request.context.stage === "thief"
  )
    requests.set(request, { scope, context: request.context });
}
export function thiefRequestScope(world: World, request: ActionRequest): ThiefScope | undefined {
  const binding = requests.get(request);
  return binding &&
    binding.scope.world === world &&
    scopes.get(world) === binding.scope &&
    request.actorId === binding.scope.actorId &&
    request.context === binding.context &&
    request.phase === Phase.Night &&
    request.context.day === 1 &&
    request.context.stage === "thief"
    ? binding.scope
    : undefined;
}
export function inheritThiefDeadlineRequest(source: ActionRequest, target: ActionRequest): void {
  const binding = requests.get(source);
  if (!binding || !thiefRequestScope(binding.scope.world, source)) return;
  const keys = Object.keys(source).filter((k) => k !== "deadlineAtMs"),
    other = Object.keys(target).filter((k) => k !== "deadlineAtMs");
  if (
    keys.length !== other.length ||
    keys.some((k) => !other.includes(k) || (source as any)[k] !== (target as any)[k])
  )
    return;
  requests.set(target, binding);
}
export function projectThiefChoices(world: World, actorId: number) {
  const scope = scopes.get(world);
  if (!scope || scope.actorId !== actorId || !sameThiefScope(scope)) return undefined;
  return {
    required: scope.required,
    cards: scope.cards.map((card, slot) => ({ slot: slot as ThiefSlot, role: card.role })),
  };
}
export class ThiefSetupWindow {
  constructor(
    private readonly world: World,
    private readonly gateway: ToolGateway,
    private readonly events: GameEvent[],
  ) {}
  async execute(
    config: BoardConfig,
    provider: ActionProvider,
    day: number,
    isCurrent: () => boolean,
  ): Promise<boolean> {
    if (hasActiveThiefSetup(this.world)) throw new Error("thief_setup_reentry");
    if (thiefSetupReady(this.world)) return true;
    if (day !== 1 || thiefSetupStatus(this.world) !== "pending" || !isCurrent())
      throw new Error("thief_setup_unavailable");
    const deal = openThiefSetup(this.world);
    let status: "complete" | "cancelled" | "failed" = "failed";
    try {
      if (!pendingThiefDealValid(this.world)) {
        status = "cancelled";
        return false;
      }
      const actorIds = this.world
        .getAliveEntityIds()
        .filter(
          (id) => this.world.getComponent<RoleComponent>(id, COMPONENT.Role)?.role === Role.Thief,
        );
      if (actorIds.length === 0) {
        status = "complete";
        return true;
      }
      if (actorIds.length !== 1) throw new Error("thief_actor_invalid");
      const actorId = actorIds[0]!,
        actor = captureDebateParticipant(this.world, actorId),
        state = getThiefState(actor?.role),
        camp = this.world.getComponent<CampComponent>(actorId, COMPONENT.Camp),
        victory = this.world.getComponent<VictoryComponent>(actorId, COMPONENT.Victory);
      const cards = deal.reserve.map((card) => {
        const data = readThiefCard(card);
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
      const scope: ThiefScope = {
        world: this.world,
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
        required: cards.every((card) => card!.role === Role.Wolf),
      };
      scopes.set(this.world, scope);
      if (!sameThiefScope(scope)) {
        status = "cancelled";
        return false;
      }
      const request = new GameActionRequestFactory(this.world, this.events, 1).create({
        phase: Phase.Night,
        actorId,
        allowedTools: ["choose_thief_card"],
        stage: "thief",
        requiresAction: scope.required,
        summary: { key: scope.required ? "turn.thief.required" : "turn.thief.optional" },
        context: { allow_fallback: false, action_failure_policy: "error" },
      });
      if (!sameThiefScope(scope)) {
        status = "cancelled";
        return false;
      }
      const call = await provider.getAction(request);
      if (!sameThiefScope(scope)) {
        status = "cancelled";
        return false;
      }
      let slot: ThiefSlot | null = null;
      if (call === null) {
        if (scope.required) throw new Error("thief_required_choice_missing");
      } else {
        const choiceCall = readThiefTool(call);
        if (!choiceCall) throw new Error("thief_choice_invalid");
        const valid = this.gateway.validateAndSanitize(this.world, actorId, choiceCall, {
          phase: Phase.Night,
          day: 1,
          thiefScope: scope,
        });
        if (!sameThiefScope(scope)) {
          status = "cancelled";
          return false;
        }
        if (!valid.ok) throw new Error("thief_choice_invalid");
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
      if (!sameThiefScope(scope)) {
        status = "cancelled";
        return false;
      }
      // No await, provider callback or event between physical swap and identity installation.
      if (chosen && slot !== null && newRole && newCamp && newVictory) {
        selectThiefCard(this.world, actorId, slot);
        this.world.addComponent(actorId, COMPONENT.Role, newRole);
        this.world.addComponent(actorId, COMPONENT.Camp, newCamp);
        this.world.addComponent(actorId, COMPONENT.Victory, newVictory);
      } else {
        state.remaining = 0;
        state.choice = null;
        selectThiefCard(this.world, actorId, null);
      }
      status = "complete";
      closeThiefSetup(this.world, status);
      scopes.delete(this.world);
      this.events.push({
        timestamp: Date.now(),
        type: "thief_identity_chosen",
        payload: {
          actorId,
          day: 1,
          slot,
          role: newRole?.role ?? Role.Thief,
          camp: newRole?.camp ?? Camp.Good,
          policy: THIEF_POLICY,
        },
      });
      return true;
    } finally {
      scopes.delete(this.world);
      closeThiefSetup(this.world, status);
    }
  }
}
