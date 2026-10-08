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
import type { DreamNightFrame } from "../mechanisms/roles/dreamer/night_frame";

interface DeathWaveActions { phase: Phase; day: number; permits: Array<ReturnType<World["openDeathAction"]>>; isCurrent:()=>boolean }

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
    nightEffects?: {dreams: DreamNightFrame; nightOriginIds: readonly EntityId[]; isCurrent?:()=>boolean},
  ): Promise<void> {
    const resolutionPhase = this.state.phase;
    const resolutionDay = this.state.day;
    const isCurrent=()=>this.state.phase===resolutionPhase&&this.state.day===resolutionDay&&!this.state.gameOver&&(nightEffects?.isCurrent?.()??true);
    const seen = new Set<EntityId>(deadIds.filter(id => {
      return this.world.getComponent<AliveComponent>(id, COMPONENT.Alive) !== undefined && !this.isSettledLife(id);
    }));
    let pending = [...seen];
    const allSources: DeathSources = structuredClone(sources);
    const initialPhases = structuredClone(deathPhases);
    const nightOrigin = new Set(nightEffects?.nightOriginIds??[]);
    let firstBatch = true;

    while (pending.length > 0) {
      if (!isCurrent()) return;
      const deathPhase = firstBatch ? phase : this.state.phase;
      this.markPlayersDead(pending);
      nightEffects?.dreams.recordDeaths(pending,this.events);
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
        await this.collectLastWords(pending, lastWordsPhase, phase, allSources, actionProvider, initialPhases,isCurrent);
      }
      if (!isCurrent()) return;

      // 先处理警长死亡带来的警徽逻辑，再执行角色死亡钩子。
      for (const deadId of pending) {
        const causes = allSources[deadId] ?? [];
        const actualDeathPhase = firstBatch ? initialPhases[deadId] ?? deathPhase : deathPhase;
        const reason = causes.includes(DeathCause.SelfDestruct) ? "self_destruct" : causes.includes(DeathCause.Exile) ? "voted_out" : `${actualDeathPhase}_death`;
        transferOrDestroySheriffBadge(this.world, deadId, reason, this.events);
      }

      const next = new Set<EntityId>();
      for (const deadId of pending) {
        if (!isCurrent()) return;
        const actions: DeathWaveActions = { phase: resolutionPhase, day: resolutionDay, permits: [],isCurrent };
        try {
          await this.eventRegistry.onDeath(
            this.world, [deadId], allSources,
            actorId => this.collectDeathShot(actorId, firstBatch ? initialPhases[actorId] ?? deathPhase : deathPhase, allSources, actionProvider, actions),
            this.events,
            result => {
              if(!isCurrent())return;
              const proposed=[...result.extraDeaths],proposedSources=structuredClone(result.extraDeathSources),nightTargets=result.nightEffectTargets??[];
              const linked=new Set<EntityId>(),publicLinked:EntityId[]=[];
              for (const id of nightTargets) nightOrigin.add(id);
              if (nightEffects && nightTargets.length) for (const id of nightEffects.dreams.linkedDeaths(this.world,nightTargets,new Set(Object.keys(allSources).map(Number)))) {
                linked.add(id);
                if (!proposed.includes(id)) proposed.push(id);
                proposedSources[id]=[...new Set([...(proposedSources[id]??[]),DeathCause.Dream])];nightOrigin.add(id);
              }
              for (const id of proposed) {
                if (next.has(id)) {
                  allSources[id] = [...new Set([...(allSources[id] ?? []), ...(proposedSources[id] ?? [])])];
                  continue;
                }
                if (seen.has(id) || this.isSettledLife(id)) {
                  if(linked.has(id))allSources[id]=[...new Set([...(allSources[id]??[]),DeathCause.Dream])];
                  continue;
                }
                if (!this.world.getComponent<AliveComponent>(id, COMPONENT.Alive)) continue;
                seen.add(id);
                allSources[id] = [...new Set(proposedSources[id] ?? [])];
                this.markPlayersDead([id]);
                if(linked.has(id)&&!result.extraDeaths.includes(id))publicLinked.push(id);
                next.add(id);
              }
              if(publicLinked.length)this.events.push({timestamp:Date.now(),type:"additional_deaths",payload:{deaths:publicLinked}});
              nightEffects?.dreams.recordDeaths([...next,...linked],this.events);
            },
            {nightEffect:nightOrigin.has(deadId),blocksNightShot:targetId=>nightEffects?.dreams.blocksNightShot(this.world,targetId)??false,isCurrent},
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
    const isCurrent = () => actions.isCurrent()&&this.state.phase === actions.phase && this.state.day === actions.day && !this.state.gameOver;
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
    scopeCurrent:()=>boolean=()=>true,
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
      if (!scopeCurrent()||this.state.phase !== phase || this.state.day !== day || this.state.gameOver) return;
      const permit = this.world.openDeathAction(deadId, "speak", phase, day,scopeCurrent);
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
        if (!scopeCurrent()||this.state.phase !== phase || this.state.day !== day || this.state.gameOver || !this.world.hasDeathAction(deadId, "speak", phase, day, permit.id)) return;
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
        if(!scopeCurrent()||this.state.phase!==phase||this.state.day!==day||this.state.gameOver||!this.world.hasDeathAction(deadId,"speak",phase,day,permit.id))return;
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
