/**
 * 构造动物梦境测试的原 World、角色对象与初始座位。输入为原配置、组件和调用方字段，输出为显式 fixture 值；玩家身份和手写断言由测试提供。这里只造输入，不运行阶段、完整对局、传输、归档或规则验证器。
 */
import { createAliveComponent, createCampComponent, createVotingRightComponent } from "../../../../../src/game/observation/component-presentation";
import { World } from "../../../../../src/domain/world";
import { Role, Camp } from "../../../../../src/domain/identity";
import { COMPONENT } from "../../../../../src/domain/components/names";
import { type RoleComponent } from "../../../../../src/domain/components/role";
import { createRoleComponent } from "../../../../../src/game/observation/role-presentation";
import { type AliveComponent } from "../../../../../src/domain/components/alive";


import { createVictoryComponent } from "../../../../../src/domain/components/victory";
import { createIdentityComponent } from "../../../../../src/domain/entities/player";
import {
  freshFoxCubState,
  freshPufferfishState,
  freshWhiteCatState,
} from "../../../../../src/game/mechanisms/roles/animal_dream/state";
import { installAnimalRoster } from "../../../../../src/game/mechanisms/roles/animal_dream/roster";
import { setWolfBeautyState } from "../../../../../src/game/mechanisms/roles/wolf_beauty/ports";
import { setBearState } from "../../../../../src/game/mechanisms/roles/bear/ports";

export const animalInternalConfig = () => ({
  boardSize: 12,
  enableSheriff: true,
  animalDream: { policy: "awa_animal_dream_v1", eliminationPriority: "awa_wolf_priority_v1" },
  whiteCat: { skippedVotePolicy: "awa_wait_for_actual_exile_v1" },
  pufferfish: { ballotPolicy: "awa_final_ballot_v1" },
  bear: { signalPolicy: "netease_dawn_live_v1" },
  wolfBeauty: { deathLinkPolicy: "awa_exile_poison_v1" },
  roleSetups: [
    { role: "wolf", count: 3 },
    { role: "wolf_beauty", count: 1 },
    { role: "villager", count: 4 },
    { role: "white_cat", count: 1 },
    { role: "fox_cub", count: 1 },
    { role: "bear", count: 1 },
    { role: "pufferfish", count: 1 },
  ],
  winConditions: ["slaughter_side"],
  hooks: { onDaybreak: false, onPreElection: true, onPreVote: true, onPerSpeechGap: false },
  selfDestruct: { enabledWindows: ["on_pre_election", "on_pre_vote"] },
  tieBreaker: {
    sheriffVote: "no_elimination",
    wolfKillVote: "min_id",
    exileVote: "no_elimination",
  },
  voting: { exilePolicy: "awa_one_pk_v1" },
  disclosure: { deathRevealPolicy: "awa_hidden_v1" },
  lastWords: { policy: "awa_initial_wave_v1" },
  sheriff: {
    electionPolicy: "awa_nomination_offstage_pk_v1",
    badgePolicy: "awa_holder_choice_v1",
    voteWeight: 1.5,
  },
});
/** 原始组件夹具：独立实际 Camp 槽，不初始化 Profile、不读取公开板子或运行 PM／传输／复盘。 */
export function animalRosterFixture(
  beforeInstall?: (world: World) => void,
  install: (
    world: World,
    config: ReturnType<typeof animalInternalConfig>,
  ) => void = installAnimalRoster,
) {
  const world = new World(),
    roles = [
      "wolf_beauty",
      "wolf",
      "wolf",
      "wolf",
      "villager",
      "villager",
      "villager",
      "villager",
      "white_cat",
      "fox_cub",
      "bear",
      "pufferfish",
    ] as const;
  for (const [index, roleId] of roles.entries()) {
    const id = world.createEntity(),
      camp = index < 4 ? Camp.Wolf : Camp.Good,
      role = createRoleComponent(roleId as Role);
    if (roleId === "white_cat")
      (role.privateState as Record<string, unknown>).whiteCat = freshWhiteCatState();
    if (roleId === "fox_cub")
      (role.privateState as Record<string, unknown>).foxCub = freshFoxCubState();
    if (roleId === "pufferfish")
      (role.privateState as Record<string, unknown>).pufferfish = freshPufferfishState();
    if (roleId === "wolf_beauty")
      setWolfBeautyState(role, { targetId: null, lastActedDay: null, history: [] });
    if (roleId === "bear") setBearState(role, { history: [] });
    world.addComponent(id, COMPONENT.Role, role);
    world.addComponent(id, COMPONENT.Camp, createCampComponent(camp));
    world.addComponent(id, COMPONENT.Alive, createAliveComponent());
    world.addComponent(id, COMPONENT.VotingRight, createVotingRightComponent());
    world.addComponent(id, COMPONENT.Identity, createIdentityComponent(id, id, `p${id}`));
    world.addComponent(
      id,
      COMPONENT.Victory,
      createVictoryComponent([{ kind: "faction", faction: camp }]),
    );
  }
  beforeInstall?.(world);
  const config = animalInternalConfig();
  install(world, config);
  return {
    world,
    config,
    role: (id: number) => world.getComponent(id, COMPONENT.Role)!,
    life: (id: number) => world.getComponent(id, COMPONENT.Alive)!,
  };
}
