import type { World, ActionRequest, Phase, GameEvent } from "../../../../core/domain";
import type { ToolGateway } from "../../../gateway/tool_gateway";
import * as shared from "../initial_identity/setup";
export type ThiefScope = shared.InitialIdentityScope;
export const sameThiefScope = (s: ThiefScope) =>
  s.kind === "thief" && shared.sameInitialIdentityScope(s);
export const authorizedThiefScope = (
  world: World,
  actorId: number,
  day: number | undefined,
  phase: Phase,
  scope: object | undefined,
) => shared.authorizedInitialIdentityScope(world, actorId, day, phase, scope, "thief");
export const bindThiefRequest = (world: World, r: ActionRequest) => {
  if (r.context.stage === "thief") shared.bindInitialIdentityRequest(world, r);
};
export const thiefRequestScope = (world: World, r: ActionRequest) => {
  const s = shared.initialIdentityRequestScope(world, r);
  return s?.kind === "thief" ? s : undefined;
};
export const inheritThiefDeadlineRequest = (a: ActionRequest, b: ActionRequest) => {
  if (a.context.stage === "thief") shared.inheritInitialIdentityDeadlineRequest(a, b);
};
export function projectThiefChoices(world: World, actorId: number) {
  const s = shared.initialIdentityRequestChoices(world, actorId, "thief");
  return s ? { required: s.mustChoose, cards: s.cards } : undefined;
}
/** Instantiate lazily: catalog imports this module while the shared setup is still evaluating. */
export class ThiefSetupWindow {
  private readonly window: shared.InitialIdentitySetupWindow;
  constructor(world: World, gateway: ToolGateway, events: GameEvent[]) {
    this.window = new shared.InitialIdentitySetupWindow(world, gateway, events, "thief");
  }
  execute(...args: Parameters<shared.InitialIdentitySetupWindow["execute"]>): Promise<boolean> {
    return this.window.execute(...args);
  }
}
