import {
  ActionWindow,
  Role,
  WinCondition,
  WitchSelfHealRule,
  type BoardConfig,
} from "../../core/domain/model";
export const tricksterTwelveConfig: BoardConfig = {
  boardSize: 12,
  trickster: { policy: "awa_trickster_exile_v1" },
  magician: {
    policy: "awa_magician_wolf_king_v1",
    firstNight: 1,
    deathShotTargetPolicy: "original",
  },
  enableSheriff: true,
  orderPrince: { policy: "awa_order_prince_first_ballot_v1" },
  seer: { targetPolicy: "awa_alive_v1", actionPolicy: "awa_required_when_legal_v1" },
  winConditions: [WinCondition.SlaughterSide],
  hooks: { onDaybreak: false, onPreElection: true, onPreVote: true, onPerSpeechGap: false },
  selfDestruct: { enabledWindows: [ActionWindow.OnPreElection, ActionWindow.OnPreVote] },
  witch: {
    canSelfHeal: WitchSelfHealRule.Disabled,
    knifeVisibility: "awa_with_heal_v1",
    potionPolicy: "awa_one_native_v1",
  },
  sheriff: {
    electionPolicy: "awa_nomination_offstage_pk_v1",
    badgePolicy: "awa_holder_choice_v1",
    voteWeight: 1.5,
  },
  tieBreaker: {
    sheriffVote: "no_elimination",
    wolfKillVote: "min_id",
    exileVote: "no_elimination",
  },
  voting: { exilePolicy: "awa_one_pk_v1" },
  disclosure: { deathRevealPolicy: "awa_hidden_v1" },
  lastWords: { policy: "awa_initial_wave_v1" },
  roleSetups: [
    { role: Role.Wolf, count: 3 },
    { role: Role.Villager, count: 4 },
    { role: Role.Seer, count: 1 },
    { role: Role.Witch, count: 1 },
    { role: Role.Magician, count: 1 },
    { role: Role.Trickster, count: 1 },
    { role: Role.OrderPrince, count: 1 },
  ],
};
