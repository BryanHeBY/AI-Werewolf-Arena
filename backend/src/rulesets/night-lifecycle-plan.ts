/**
 * Composes cycle-owned night cleanup receivers at the existing manager positions.
 * Inputs are deferred manager World/config reads and the concrete pipeline units;
 * outputs retain ordered normal, interrupted, inner-finally and outer cleanup.
 * Each handoff stores the original unit, including its cleanup ownership state.
 * Before handoff the native terminal retains the original early-failure behavior.
 * Argument reads remain late; no close is deduplicated and no acquired guard,
 * resource refund, phase advancement or serialized runtime handle is introduced.
 */
import type { ReadonlyBoardConfig } from "@ai-werewolf-arena/game-contract";
import type { World } from "../core/domain/world";
import {
  demonNightTerminal,
  type DemonNightUnit,
} from "../game/mechanisms/roles/demon_hunter/ports";
import {
  weddingNightTerminal,
  type WeddingNightUnit,
} from "../game/mechanisms/roles/ghost_bride/ports";
import {
  magicianNightTerminal,
  type MagicianNightUnit,
} from "../game/mechanisms/roles/magician/ports";
import {
  wolfSorcererNightTerminal,
  type WolfSorcererNightUnit,
} from "../game/mechanisms/roles/wolf_sorcerer/ports";
import {
  tricksterNightTerminal,
  type TricksterNightUnit,
} from "../game/mechanisms/roles/trickster/ports";
import {
  timeConsortNightTerminal,
  type TimeConsortNightUnit,
} from "../game/mechanisms/roles/time_wolf_consort/ports";
import {
  scholarMentorNightTerminal,
  type ScholarMentorNightUnit,
} from "../game/mechanisms/roles/scholar_mentor/ports";
import {
  mistNightTerminal,
  type MistNightUnit,
} from "../game/mechanisms/roles/mist_raven/ports";
import { nobleNightReceiver } from "../game/mechanisms/roles/noble_secret_body/ports";
import { abortAnimalGame } from "../game/mechanisms/roles/animal_dream/ports";

import { bindBoardParameters } from "./board-parameters";
import { Phase } from "@ai-werewolf-arena/game-contract";
import { getSessionRecorder } from "../recording/recording_context";
import { randomDraws, type RandomSource } from "../core/domain/random";
import { AnimalNightUnit } from "../game/mechanisms/roles/animal_dream/ports";
import { FragrantNightUnit, FRAGRANT_PAIR_POLICY } from "../game/mechanisms/roles/fragrant_pair_seer/ports";
import { NobleNightUnit } from "../game/mechanisms/roles/noble_secret_body/ports";
import { RadiantNightUnit } from "../game/mechanisms/roles/radiant_eclipse/ports";
import { DemonNightUnit as ConcreteDemonNightUnit, demonHunterActorId } from "../game/mechanisms/roles/demon_hunter/ports";
import { WeddingNightUnit as ConcreteWeddingNightUnit, weddingSetup } from "../game/mechanisms/roles/ghost_bride/ports";
import { MagicianNightUnit as ConcreteMagicianNightUnit } from "../game/mechanisms/roles/magician/ports";
import { WolfSorcererNightUnit as ConcreteWolfSorcererNightUnit } from "../game/mechanisms/roles/wolf_sorcerer/ports";
import { TricksterNightUnit as ConcreteTricksterNightUnit } from "../game/mechanisms/roles/trickster/ports";
import { TimeConsortNightUnit as ConcreteTimeConsortNightUnit } from "../game/mechanisms/roles/time_wolf_consort/ports";
import { ScholarMentorNightUnit as ConcreteScholarMentorNightUnit } from "../game/mechanisms/roles/scholar_mentor/ports";
import { MistNightUnit as ConcreteMistNightUnit } from "../game/mechanisms/roles/mist_raven/ports";
import { openLonelyGirlNight } from "../game/mechanisms/roles/lonely_girl/ports";
import { openWildChildNight } from "../game/mechanisms/roles/wild_child/ports";
import { openInitialIdentityNight } from "../game/mechanisms/roles/initial_identity/ports";

export interface NightManagerLifecycleRuntime {
  readonly world: World;
  readonly config: ReadonlyBoardConfig;
  abortMistPending(): void;
}

/** Only the pipeline can publish its concrete late ownership transfers. */
export interface NightLifecycleHandoff {
  receiveDemon(unit: DemonNightUnit): void;
  receiveWedding(unit: WeddingNightUnit): void;
  receiveExchange(
    magician: MagicianNightUnit,
    sorcerer: WolfSorcererNightUnit,
    trickster: TricksterNightUnit,
  ): void;
  receiveTimeConsort(unit: TimeConsortNightUnit): void;
  receiveScholarMentor(unit: ScholarMentorNightUnit): void;
  receiveMist(unit: MistNightUnit): void;
}

export class NightManagerLifecycle implements NightLifecycleHandoff {
  private demon: Pick<DemonNightUnit, "close"> = demonNightTerminal;
  private wedding: Pick<WeddingNightUnit, "close"> = weddingNightTerminal;
  private magician: Pick<MagicianNightUnit, "closeNormally" | "abort"> = magicianNightTerminal;
  private sorcerer: Pick<WolfSorcererNightUnit, "closeNormally" | "abort"> =
    wolfSorcererNightTerminal;
  private trickster: Pick<TricksterNightUnit, "finishNormally" | "abort"> =
    tricksterNightTerminal;
  private time: Pick<TimeConsortNightUnit, "closeNormally" | "abort"> = timeConsortNightTerminal;
  private scholar: Pick<ScholarMentorNightUnit, "closeNormally" | "abort"> =
    scholarMentorNightTerminal;
  private mist: Pick<MistNightUnit, "closeNormally" | "abort"> = mistNightTerminal;

  constructor(private readonly runtime: NightManagerLifecycleRuntime) {}

  receiveDemon(unit: DemonNightUnit): void {
    this.demon = unit;
  }

  receiveWedding(unit: WeddingNightUnit): void {
    this.wedding = unit;
  }

  receiveExchange(
    magician: MagicianNightUnit,
    sorcerer: WolfSorcererNightUnit,
    trickster: TricksterNightUnit,
  ): void {
    this.magician = magician;
    this.sorcerer = sorcerer;
    this.trickster = trickster;
  }

  receiveTimeConsort(unit: TimeConsortNightUnit): void {
    this.time = unit;
  }

  receiveScholarMentor(unit: ScholarMentorNightUnit): void {
    this.scholar = unit;
  }

  receiveMist(unit: MistNightUnit): void {
    this.mist = unit;
  }

  closeNobleNormally(result: { interrupted: false }, day: number): void {
    nobleNightReceiver(result).closeNormally(this.runtime.world, day);
  }

  abortSpecialNight(result: object, day: number): void {
    if (this.runtime.config.nobleSecretBody)
      nobleNightReceiver(result).abort(this.runtime.world, day);
    this.demon.close(this.runtime.world);
    this.wedding.close(this.runtime.world);
  }

  finishDay(day: number, isCurrent: () => boolean): void {
    if (this.runtime.config.trickster && isCurrent()) this.trickster.finishNormally(this.runtime.world, day);
    if (this.runtime.config.wolfSorcerer && isCurrent()) this.sorcerer.closeNormally(this.runtime.world, day);
    if (this.runtime.config.magician && isCurrent()) this.magician.closeNormally(this.runtime.world, day);
    if (this.runtime.config.timeConsort && isCurrent()) this.time.closeNormally(this.runtime.world, day);
    if (this.runtime.config.scholarMentor && isCurrent()) this.scholar.closeNormally(this.runtime.world, day);
    if (this.runtime.config.mistRaven && isCurrent()) this.mist.closeNormally(this.runtime.world, day);
  }

  closeMistNormally(day: number): void {
    this.mist.closeNormally(this.runtime.world, day);
  }

  abortInner(): void {
    if (this.runtime.config.mistRaven) this.mist.abort(this.runtime.world);
    if (this.runtime.config.trickster) this.trickster.abort(this.runtime.world);
    if (this.runtime.config.wolfSorcerer) this.sorcerer.abort(this.runtime.world);
    if (this.runtime.config.magician) this.magician.abort(this.runtime.world);
    if (this.runtime.config.timeConsort) this.time.abort(this.runtime.world);
    if (this.runtime.config.scholarMentor) this.scholar.abort(this.runtime.world);
  }

  abortOnError(): void {
    if (this.runtime.config.animalDream) abortAnimalGame(this.runtime.world);
  }

  abortCycle(completed: boolean): void {
    if (this.runtime.config.animalDream && !completed) abortAnimalGame(this.runtime.world);
    if (this.runtime.config.mistRaven) {
      this.runtime.abortMistPending();
      this.mist.abort(this.runtime.world);
    }
    if (this.runtime.config.timeConsort) this.time.abort(this.runtime.world);
    if (this.runtime.config.scholarMentor) this.scholar.abort(this.runtime.world);
    if (this.runtime.config.wolfSorcerer) this.sorcerer.abort(this.runtime.world);
    if (this.runtime.config.magician) this.magician.abort(this.runtime.world);
  }
}

export interface NightPipelineLifecycleRuntime {
  readonly world: World;
  readonly events: import("@ai-werewolf-arena/game-contract").GameEvent[];
  readonly random: RandomSource;
}

/** Preserve pre-try opening and each concrete constructor's original position. */
export function prepareNightPipelineLifecycle(
  runtime: NightPipelineLifecycleRuntime,
  config: ReadonlyBoardConfig,
  day: number,
  handoff?: () => NightLifecycleHandoff | undefined,
) {
    let parameterWorld: World;
    const closeLonelyGirlNight = openLonelyGirlNight(
      ((parameterWorld = runtime.world),
      (config = bindBoardParameters(parameterWorld, config).board),
      parameterWorld),
      day,
    );
    const closeWildChildNight = openWildChildNight(runtime.world, day, runtime.events);
    const closeThiefNight = openInitialIdentityNight(runtime.world, day);
    const ownsWedding = weddingSetup(runtime.world) !== null;
    const ownsDemon = demonHunterActorId(runtime.world) !== null;
    const magicianNight = new ConcreteMagicianNightUnit({
      get world() {
        return pipeline.world;
      },
    });
    const wolfSorcererNight = new ConcreteWolfSorcererNightUnit(
      {
        get world() {
          return pipeline.world;
        },
      },
      magicianNight.cleanupOwnership,
    );
    const tricksterNight = new ConcreteTricksterNightUnit(
      {
        get world() {
          return pipeline.world;
        },
      },
      magicianNight.cleanupOwnership,
    );
    const timeConsortNight = new ConcreteTimeConsortNightUnit({
      get world() {
        return pipeline.world;
      },
    });
    const scholarMentorNight = new ConcreteScholarMentorNightUnit({
      get world() {
        return pipeline.world;
      },
    });
    const ownsNoble = config.nobleSecretBody !== undefined;
    const ownsFragrant = config.fragrantPairSeer !== undefined;
    const ownsAnimal = config.animalDream !== undefined;
    const pipeline = runtime;
    const animalNight = new AnimalNightUnit(
      {
        get world() {
          return pipeline.world;
        },
        get events() {
          return pipeline.events;
        },
      },
      day,
    );
    const fragrantNight = new FragrantNightUnit(
      {
        get world() {
          return pipeline.world;
        },
        get events() {
          return pipeline.events;
        },
        drawKnowledge() {
          return randomDraws(pipeline.random.fork("fragrant-known-wolf"));
        },
        recordOpening(day, notice) {
          getSessionRecorder()?.recordRequiredLogicOp({
            scope: "phase_pipeline",
            op: "fragrant_night_opened",
            phase: Phase.Night,
            status: "ok",
            output: {
              policy: FRAGRANT_PAIR_POLICY,
              day,
              notice,
              knowledgeDrawCount: day === 1 ? 1 : 0,
            },
          });
        },
      },
      day,
    );
    const nobleNight = new NobleNightUnit(
      {
        get world() {
          return pipeline.world;
        },
        get events() {
          return pipeline.events;
        },
        recordOpening(payload) {
          getSessionRecorder()?.recordRequiredLogicOp({
            scope: "phase_pipeline",
            op: "noble_body_night_opened",
            phase: Phase.Night,
            status: "ok",
            output: payload,
          });
        },
      },
      day,
    );
    const ownsRadiant = config.radiantEclipse !== undefined;
    const radiantNight = new RadiantNightUnit(
      {
        get world() {
          return pipeline.world;
        },
        get events() {
          return pipeline.events;
        },
      },
      day,
    );
    const ownsMist = config.mistRaven !== undefined;
    const mistNight = new ConcreteMistNightUnit(
      {
        get world() {
          return pipeline.world;
        },
        get events() {
          return pipeline.events;
        },
      },
      day,
    );
    const demonNight = new ConcreteDemonNightUnit({
      get world() {
        return pipeline.world;
      },
    });
    const weddingNight = new ConcreteWeddingNightUnit(
      {
        get world() {
          return pipeline.world;
        },
        get events() {
          return pipeline.events;
        },
      },
      ownsWedding,
    );
  return {
    config, ownsWedding, ownsDemon, ownsNoble, ownsFragrant, ownsAnimal, ownsRadiant, ownsMist,
    animalNight, fragrantNight, nobleNight, radiantNight, mistNight,
    demonNight, weddingNight, magicianNight, wolfSorcererNight, tricksterNight,
    timeConsortNight, scholarMentorNight,
    open(isCurrent: () => boolean) {
      if (ownsAnimal) animalNight.open(isCurrent);
      if (ownsFragrant) fragrantNight.open(isCurrent);
      if (ownsNoble) nobleNight.open(isCurrent);
      if (ownsRadiant) radiantNight.open();
      if (ownsDemon) demonNight.open(day, isCurrent);
      if (ownsMist) mistNight.open();
    },
    finishPipeline() {
      if (ownsRadiant) radiantNight.closeNormally();
      if (ownsAnimal) animalNight.closeNormally();
      if (ownsFragrant) fragrantNight.closeNormally();
      if (ownsNoble) nobleNight.transferToManager();
      weddingNight.transferToManager(ownsWedding);
      handoff?.()?.receiveWedding(weddingNight);
      demonNight.transferToManager(ownsDemon);
      handoff?.()?.receiveDemon(demonNight);
      magicianNight.transferToManager(config.magician !== undefined);
      handoff?.()?.receiveExchange(magicianNight, wolfSorcererNight, tricksterNight);
      timeConsortNight.transferToManager(config.timeConsort !== undefined);
      handoff?.()?.receiveTimeConsort(timeConsortNight);
      scholarMentorNight.transferToManager(config.scholarMentor !== undefined);
      handoff?.()?.receiveScholarMentor(scholarMentorNight);
      mistNight.transferToManager(ownsMist);
      handoff?.()?.receiveMist(mistNight);
    },
    abortPipeline() {
      animalNight.abortIfOwned();
      fragrantNight.abortIfOwned();
      nobleNight.abortIfOwned();
      radiantNight.abortIfAcquired();
      if (ownsMist) mistNight.abortIfOwned();
      if (config.trickster) tricksterNight.abortIfOwned();
      if (config.wolfSorcerer) wolfSorcererNight.abortIfOwned();
      if (config.magician) magicianNight.abortIfOwned();
      if (config.timeConsort) timeConsortNight.abortIfOwned();
      if (config.scholarMentor) scholarMentorNight.abortIfOwned();
      demonNight.abortIfOwned();
      weddingNight.abortIfOwned();
      closeThiefNight();
      closeWildChildNight();
      closeLonelyGirlNight();
    },
  };
}
