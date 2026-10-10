import type { World, ActionRequest, Phase, GameEvent } from "../../../../core/domain";
import type { ToolGateway } from "../../../gateway/tool_gateway";
import * as shared from "../initial_identity/setup";
export type ShapeshifterScope = shared.InitialIdentityScope;
export const sameShapeshifterScope = (s: ShapeshifterScope) =>
  s.kind === "shapeshifter" && shared.sameInitialIdentityScope(s);
export const authorizedShapeshifterScope = (
  world: World,
  actorId: number,
  day: number | undefined,
  phase: Phase,
  scope: object | undefined,
) => shared.authorizedInitialIdentityScope(world, actorId, day, phase, scope, "shapeshifter");
export const bindShapeshifterRequest = (world: World, r: ActionRequest) => {
  if (r.context.stage === "shapeshifter") shared.bindInitialIdentityRequest(world, r);
};
export const shapeshifterRequestScope = (world: World, r: ActionRequest) => {
  const s = shared.initialIdentityRequestScope(world, r);
  return s?.kind === "shapeshifter" ? s : undefined;
};
export const inheritShapeshifterDeadlineRequest = (a: ActionRequest, b: ActionRequest) => {
  if (a.context.stage === "shapeshifter") shared.inheritInitialIdentityDeadlineRequest(a, b);
};
export function projectShapeshifterChoices(world: World, actorId: number) {
  const s = shared.initialIdentityRequestChoices(world, actorId, "shapeshifter");
  return s;
}
/** Instantiate lazily: catalog imports this module while the shared setup is still evaluating. */
export class ShapeshifterSetupWindow {
  private readonly window: shared.InitialIdentitySetupWindow;
  constructor(world: World, gateway: ToolGateway, events: GameEvent[]) {
    this.window = new shared.InitialIdentitySetupWindow(world, gateway, events, "shapeshifter");
  }
  execute(...args: Parameters<shared.InitialIdentitySetupWindow["execute"]>): Promise<boolean> {
    return this.window.execute(...args);
  }
}
