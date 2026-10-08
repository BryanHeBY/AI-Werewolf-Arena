import { AliveComponent, aliveLifeVersion } from "../../core/domain/components/alive";
import { COMPONENT } from "../../core/domain/components/names";
import { ActionProvider, EntityId, GameEvent, Phase, Role, RuntimeSnapshot, DeathCause, type DeathSources, type DeathShotSelection } from "../../core/domain/model";
import type { RoleComponent } from "../../core/domain/components/role";
import { World } from "../../core/domain/world";
import { ToolGateway } from "../gateway/tool_gateway";
import { getDefaultLastWordsMechanism } from "../mechanisms/last_words/last_words_mechanism";
import { transferOrDestroySheriffBadge } from "../mechanisms/sheriff/badge";
import { GameActionRequestFactory } from "./action_request_factory";
import { EventRegistry } from "./event_registry";

interface DeathWaveActions { phase: Phase; day: number; permits: Array<ReturnType<World["openDeathAction"]>> }

/** Resolves successive death waves without advancing the current action phase. */
export class DeathResolution {
  private readonly lastWordsMechanism = getDefaultLastWordsMechanism();
  private readonly settledLives = new Map<EntityId, { component: AliveComponent; version: number | undefined }>();

  constructor(
    private readonly world: World,
    private readonly events: GameEvent[],
    private readonly toolGateway: ToolGateway,
    private readonly eventRegistry: EventRegistry,
    private readonly state: RuntimeSnapshot,
  ) {}

  async resolve(
    deadIds: EntityId[],
    sources: DeathSources,
    actionProvider: ActionProvider,
    phase: Phase,
    lastWordsPhase: Phase,
    deathPhases: Readonly<Record<EntityId, Phase>> = {},
  ): Promise<void> {
    const resolutionPhase = this.state.phase;
    const resolutionDay = this.state.day;
    const seen = new Set<EntityId>(deadIds.filter(id => {
      return this.world.getComponent<AliveComponent>(id, COMPONENT.Alive) !== undefined && !this.isSettledLife(id);
    }));
    let pending = [...seen];
    const allSources: DeathSources = structuredClone(sources);
    const initialPhases = structuredClone(deathPhases);
    let firstBatch = true;

    while (pending.length > 0) {
      if (this.state.phase !== resolutionPhase || this.state.day !== resolutionDay || this.state.gameOver) return;
      const deathPhase = firstBatch ? phase : this.state.phase;
      this.markPlayersDead(pending);
      if (firstBatch) {
        this.lastWordsMechanism.recordLastWordsGranted(
          this.world,
          pending,
          phase,
          lastWordsPhase,
          this.state.day,
          this.events,
          allSources,
          initialPhases,
        );
        await this.collectLastWords(pending, lastWordsPhase, phase, allSources, actionProvider, initialPhases);
      }
      if (this.state.phase !== resolutionPhase || this.state.day !== resolutionDay || this.state.gameOver) return;

      // 先处理警长死亡带来的警徽逻辑，再执行角色死亡钩子。
      for (const deadId of pending) {
        const causes = allSources[deadId] ?? [];
        const actualDeathPhase = firstBatch ? initialPhases[deadId] ?? deathPhase : deathPhase;
        const reason = causes.includes(DeathCause.SelfDestruct) ? "self_destruct" : causes.includes(DeathCause.Exile) ? "voted_out" : `${actualDeathPhase}_death`;
        transferOrDestroySheriffBadge(this.world, deadId, reason, this.events);
      }

      const next = new Set<EntityId>();
      for (const deadId of pending) {
        if (this.state.phase !== resolutionPhase || this.state.day !== resolutionDay || this.state.gameOver) return;
        const actions: DeathWaveActions = { phase: resolutionPhase, day: resolutionDay, permits: [] };
        try {
          await this.eventRegistry.onDeath(
            this.world, [deadId], allSources,
            actorId => this.collectDeathShot(actorId, firstBatch ? initialPhases[actorId] ?? deathPhase : deathPhase, allSources, actionProvider, actions),
            this.events,
            result => {
              for (const id of result.extraDeaths) {
                if (next.has(id)) {
                  allSources[id] = [...new Set([...(allSources[id] ?? []), ...(result.extraDeathSources[id] ?? [])])];
                  continue;
                }
                if (seen.has(id) || !this.world.getComponent<AliveComponent>(id, COMPONENT.Alive) || this.isSettledLife(id)) continue;
                seen.add(id);
                allSources[id] = [...new Set(result.extraDeathSources[id] ?? [])];
                this.markPlayersDead([id]);
                next.add(id);
              }
            },
          );
        } finally {
          for (const permit of actions.permits) permit.close();
        }
      }

      pending = [...next];
      firstBatch = false;
    }
  }

  private async collectDeathShot(actorId: EntityId, deathPhase: Phase, sources: DeathSources, actionProvider: ActionProvider, actions: DeathWaveActions): Promise<DeathShotSelection> {
    const isCurrent = () => this.state.phase === actions.phase && this.state.day === actions.day && !this.state.gameOver;
    if (!isCurrent()) return { kind: "invalid" };
    const permit = this.world.openDeathAction(actorId, "shoot", actions.phase, actions.day, isCurrent);
    actions.permits.push(permit);
    const requests = new GameActionRequestFactory(this.world, this.events, actions.day);
    for (let attempt = 1; attempt <= 3; attempt++) {
      const action = await actionProvider.getAction(requests.create({
        phase: actions.phase, actorId: actorId, allowedTools: ["shoot"], stage: this.world.getComponent<RoleComponent>(actorId, COMPONENT.Role)?.role === Role.Hunter ? "hunter_shot" : "death_shot", requiresAction: true,
        summary: { key: "request.summary.death_shot" },
        context: {
          trigger: "on_death", death_phase: deathPhase, death_sources: [...(sources[actorId] ?? [])], death_action_id: permit.id,
          ...(attempt === 1 ? {} : { retry_attempt: attempt - 1, retry_max: 2 }),
        },
      }));
      if (!isCurrent() || !this.world.hasDeathAction(actorId, "shoot", actions.phase, actions.day, permit.id)) return { kind: "invalid" };
      if (action?.name !== "shoot") continue;
      const validated = this.toolGateway.validateAndSanitize(this.world, actorId, action, { phase: actions.phase, day: actions.day, deathActionId: permit.id });
      if (!validated.ok || !validated.sanitizedCall) continue;
      const targetId = validated.sanitizedCall.args.target_id;
      return targetId === null ? { kind: "pass", deathActionId: permit.id } : { kind: "shot", targetId, deathActionId: permit.id };
    }
    return { kind: "invalid" };
  }

  private isSettledLife(id: EntityId): boolean {
    const alive = this.world.getComponent<AliveComponent>(id, COMPONENT.Alive), settled = this.settledLives.get(id);
    return alive !== undefined && settled?.component === alive && settled.version === aliveLifeVersion(alive);
  }

  private async collectLastWords(
    deadIds: EntityId[],
    phase: Phase,
    deathPhase: Phase,
    sources: DeathSources,
    actionProvider: ActionProvider,
    deathPhases: Readonly<Record<EntityId, Phase>>,
  ): Promise<void> {
    const requests = new GameActionRequestFactory(
      this.world,
      this.events,
      this.state.day,
    );
    const day = this.state.day;
    for (const deadId of deadIds) {
      const actualDeathPhase = deathPhases[deadId] ?? deathPhase;
      if (!this.lastWordsMechanism.shouldGrantLastWords(actualDeathPhase, day, sources[deadId] ?? [])) continue;
      if (this.state.phase !== phase || this.state.day !== day || this.state.gameOver) return;
      const permit = this.world.openDeathAction(deadId, "speak", phase, day);
      try {
        const action = await actionProvider.getAction(requests.create({
          phase,
          actorId: deadId,
          allowedTools: ["speak"],
          stage: "last_words",
          requiresAction: true,
          summary: { key: "request.summary.last_words" },
          context: {
            trigger: "last_words",
            death_phase: actualDeathPhase,
            death_action_id: permit.id,
          },
        }));
        if (this.state.phase !== phase || this.state.day !== day || this.state.gameOver || !this.world.hasDeathAction(deadId, "speak", phase, day, permit.id)) return;
        if (action?.name !== "speak") {
          continue;
        }
        const validated = this.toolGateway.validateAndSanitize(
          this.world,
          deadId,
          action,
          {
            phase,
            day: this.state.day,
            deathActionId: permit.id,
          },
        );
        if (!validated.ok || !validated.sanitizedCall) {
          continue;
        }
        this.events.push({
          timestamp: Date.now(),
          type: "last_words_spoken",
          payload: {
            playerId: deadId,
            phase,
            day: this.state.day,
            text: validated.sanitizedCall.args.text,
          },
        });
      } finally {
        permit.close();
      }
    }
  }

  /**
   * 将待结算死亡名单真正写入存活状态。
   */
  private markPlayersDead(playerIds: EntityId[]): void {
    for (const id of playerIds) {
      const alive = this.world.getComponent<AliveComponent>(id, COMPONENT.Alive);
      if (!alive) {
        continue;
      }
      alive.alive = false;
      this.settledLives.set(id, { component: alive, version: aliveLifeVersion(alive) });
    }
  }
}
