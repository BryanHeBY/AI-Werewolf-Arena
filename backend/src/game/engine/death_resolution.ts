import { AliveComponent } from "../../core/domain/components/alive";
import { COMPONENT } from "../../core/domain/components/names";
import { ActionProvider, EntityId, GameEvent, Phase, RuntimeSnapshot, StatusMark } from "../../core/domain/model";
import { World } from "../../core/domain/world";
import { ToolGateway } from "../gateway/tool_gateway";
import { getDefaultLastWordsMechanism } from "../mechanisms/last_words/last_words_mechanism";
import { transferOrDestroySheriffBadge } from "../mechanisms/sheriff/badge";
import { GameActionRequestFactory } from "./action_request_factory";
import { EventRegistry } from "./event_registry";

/** Resolves successive death waves without advancing the current action phase. */
export class DeathResolution {
  private readonly lastWordsMechanism = getDefaultLastWordsMechanism();

  constructor(
    private readonly world: World,
    private readonly events: GameEvent[],
    private readonly toolGateway: ToolGateway,
    private readonly eventRegistry: EventRegistry,
    private readonly state: RuntimeSnapshot,
  ) {}

  async resolve(
    deadIds: EntityId[],
    sources: Record<number, StatusMark[]>,
    actionProvider: ActionProvider,
    phase: Phase,
    lastWordsPhase: Phase,
  ): Promise<void> {
    const seen = new Set<EntityId>(deadIds);
    let pending = [...seen];
    const allSources: Record<number, StatusMark[]> = { ...sources };
    let firstBatch = true;
    const requests = new GameActionRequestFactory(
      this.world,
      this.events,
      this.state.day,
    );

    while (pending.length > 0) {
      this.markPlayersDead(pending);
      if (firstBatch) {
        this.lastWordsMechanism.recordLastWordsGranted(
          this.world,
          pending,
          phase,
          lastWordsPhase,
          this.state.day,
          this.events,
        );
        await this.collectLastWords(pending, lastWordsPhase, phase, actionProvider);
      }

      // 先处理警长死亡带来的警徽逻辑，再执行角色死亡钩子。
      for (const deadId of pending) {
        transferOrDestroySheriffBadge(this.world, deadId, `${phase}_death`, this.events);
      }

      const result = await this.eventRegistry.onDeath(
        this.world,
        pending,
        allSources,
        async (hunterId) => {
          const actionPhase = this.state.phase;
          const action = await actionProvider.getAction(requests.create({
            phase: actionPhase,
            actorId: hunterId,
            allowedTools: ["shoot"],
            stage: "hunter_shot",
            requiresAction: true,
            summary: { key: "request.summary.death_shot" },
            context: {
              trigger: "on_death",
            },
          }));
          if (action?.name !== "shoot") {
            return null;
          }

          const validated = this.toolGateway.validateAndSanitize(
            this.world,
            hunterId,
            action,
            {
              phase: actionPhase,
              allowDeadHunterShoot: true,
            },
          );
          if (!validated.ok || !validated.sanitizedCall) {
            return null;
          }
          return validated.sanitizedCall.args.target_id;
        },
        this.events,
      );

      pending = result.extraDeaths.filter((id) => !seen.has(id));
      for (const id of result.extraDeaths) {
        seen.add(id);
        allSources[id] = result.extraDeathSources[id] ?? [];
      }
      firstBatch = false;
    }
  }

  private async collectLastWords(
    deadIds: EntityId[],
    phase: Phase,
    deathPhase: Phase,
    actionProvider: ActionProvider,
  ): Promise<void> {
    if (!this.lastWordsMechanism.shouldGrantLastWords(deathPhase, this.state.day)) {
      return;
    }
    const requests = new GameActionRequestFactory(
      this.world,
      this.events,
      this.state.day,
    );
    for (const deadId of deadIds) {
      const action = await actionProvider.getAction(requests.create({
        phase,
        actorId: deadId,
        allowedTools: ["speak"],
        stage: "last_words",
        requiresAction: true,
        summary: { key: "request.summary.last_words" },
        context: {
          trigger: "last_words",
          death_phase: phase,
        },
      }));
      if (action?.name !== "speak") {
        continue;
      }
      const validated = this.toolGateway.validateAndSanitize(
        this.world,
        deadId,
        action,
        {
          phase,
          allowDeadLastWords: true,
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
    }
  }
}
