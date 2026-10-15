/**
 * Unit tests check the backend-only Noble receiver on original pipeline result objects.
 * Literal data and property descriptors prove identity and JSON/spread boundaries;
 * an actual pipeline early interruption proves it does not read config ownership.
 * Original authority receivers remain callable with manager arguments. These
 * bounded cases use native in-memory components and no model, transport or game loop.
 */
import { expect, test } from "bun:test";
import { bootstrapGame } from "../../../src/app/bootstrap";
import { NightPipeline } from "../../../src/engine/phases/night-pipeline";
import { ToolGateway } from "../../../src/engine/actions/tool-gateway";
import { DamageResolutionSystem } from "../../../src/domain/systems/damage-resolution-system";
import { sixPlayerMvpConfig } from "../../../src/rulesets/presets/six-player-mvp";
import { nobleSecretBodyTwelveConfig } from "../../../src/rulesets/presets/noble-secret-body-twelve";
import { Role } from "../../../src/domain/identity";
import { NightStageRegistry } from "../../../src/rulesets/night-stage-plan";
import { checkpointNobleBodyAuthority } from "../../../src/features/noble-secret-body/authority";
import {
  attachNobleNightReceiver,
  createNobleNightAbortReceiver,
  nobleNightReceiver,
} from "../../../src/features/noble-secret-body/ports";

test("hidden receiver retains result identity and stays outside ordinary serialized data", () => {
  const receiver = createNobleNightAbortReceiver(),
    data = { interrupted: true, nested: { retained: true } },
    expected = JSON.stringify(data),
    result = attachNobleNightReceiver(data, receiver);
  expect(result).toBe(data);
  expect(nobleNightReceiver(result)).toBe(receiver);
  expect(Object.keys(result)).toEqual(["interrupted", "nested"]);
  expect(JSON.stringify(result)).toBe(expected);
  expect({ ...result }).toEqual({ interrupted: true, nested: data.nested });
  expect(Object.assign({}, result)).toEqual({ interrupted: true, nested: data.nested });
  expect(Object.getOwnPropertySymbols({ ...result })).toEqual([]);
  const symbols = Object.getOwnPropertySymbols(result);
  expect(symbols).toHaveLength(1);
  expect(Reflect.ownKeys(result)).toHaveLength(3);
  expect(Object.getOwnPropertyDescriptor(result, symbols[0]!)).toEqual({
    value: receiver,
    enumerable: false,
    configurable: false,
    writable: false,
  });
  expect(Object.keys(receiver)).toEqual(["abort"]);
  expect(() => nobleNightReceiver({ ...result })).toThrow("noble_night_receiver_missing");
});

for (const interrupt of ["before-stage", "after-stage"] as const)
  test(`actual ${interrupt} return retains sender abort and the manager's second cleanup`, async () => {
    const config = nobleSecretBodyTwelveConfig(),
      game = bootstrapGame(config, {
        fixedRoles: config.roleSetups.flatMap((r) => Array<Role>(r.count).fill(r.role)),
      });
    let pulled = false,
      executed = false;
    class Stages extends NightStageRegistry {
      override getStages() {
        pulled = true;
        return [
          {
            id: "handoff-probe",
            priority: 1,
            async execute() {
              executed = true;
            },
          },
        ];
      }
    }
    const pipeline = new NightPipeline({
      world: game.world,
      events: [],
      stageRegistry: new Stages(),
      toolGateway: new ToolGateway(),
      damageResolutionSystem: new DamageResolutionSystem(),
    });
    const result = await pipeline.execute(
      config,
      {
        async getAction() {
          throw new Error("provider_must_not_run");
        },
      },
      1,
      {
        isCurrent: () => (interrupt === "before-stage" ? !pulled : !executed),
      },
    );
    expect(result.interrupted).toBe(true);
    expect(executed).toBe(interrupt === "after-stage");
    expect(checkpointNobleBodyAuthority(game.world, false).nights[0]?.status).toBe("aborted");
    const receiver = nobleNightReceiver(result);
    expect(Object.keys(receiver)).toEqual(["closeNormally", "abort"]);
    expect(() => receiver.abort(game.world, 1)).not.toThrow();
    expect(JSON.stringify(result)).toBe('{"interrupted":true}');
  });

test("actual early pipeline interruption creates an abort-only receiver before config ownership reads", async () => {
  const game = bootstrapGame(sixPlayerMvpConfig),
    pipeline = new NightPipeline({
      world: game.world,
      toolGateway: new ToolGateway(),
      damageResolutionSystem: new DamageResolutionSystem(),
      events: [],
    });
  let configReads = 0,
    providerCalls = 0;
  const config = new Proxy(sixPlayerMvpConfig, {
    get() {
      configReads++;
      throw new Error("config_must_not_be_read");
    },
  });
  const result = await pipeline.execute(
    config,
    {
      async getAction() {
        providerCalls++;
        throw new Error("provider_must_not_run");
      },
    },
    1,
    { isCurrent: () => false },
  );
  expect(configReads).toBe(0);
  expect(providerCalls).toBe(0);
  expect(JSON.stringify(result)).toBe('{"interrupted":true}');
  expect(Object.keys(nobleNightReceiver(result))).toEqual(["abort"]);
  expect(() => nobleNightReceiver(result).abort(game.world, 1)).not.toThrow();
});
