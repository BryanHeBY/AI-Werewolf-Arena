/**
 * 负责全 55 个原生角色捕获程序的显式装配与分派。输入为有限角色展示 ID、原 Role／World 引用、语言和晚读阵营 source；输出为对应机制捕获的原提示字符串。
 * 本组合表不读取状态、执行 currentCamp 或格式化片段；读取与异常顺序由 features/<机制>/presentation.ts 保持，状态仍只有原 owner。
 * Catalog 仍在实际装配时动态加载此入口，不能从 profile 声明反向提前初始化整张捕获表。
 */
import type { Locale, NativeRolePresentationId } from "@ai-werewolf-arena/game-contract";
import type { RoleComponent } from "../../domain/components/role";
import type { World } from "../../domain/world";
import type { CurrentCampSource } from "../../domain/components/camp";
import {
  captureWhiteCatPresentation,
  captureFoxCubPresentation,
  capturePufferfishPresentation,
} from "../../features/animal-dream/presentation";
import {
  captureFragrantPhantomPresentation,
  captureAwakenedSeerPresentation,
} from "../../features/fragrant-pair-seer/presentation";
import {
  captureNightNoblePresentation,
  captureAwakenedIdiotPresentation,
} from "../../features/noble-secret-body/presentation";
import {
  captureRadiantCountPresentation,
  captureEclipseMaidPresentation,
  captureAlchemistPresentation,
  captureRavenClawWolfPresentation,
} from "../../features/radiant-eclipse/presentation";
import {
  captureDayScholarPresentation,
  captureNightMentorPresentation,
} from "../../features/scholar-mentor/presentation";
import { captureTimeWolfConsortPresentation } from "../../features/time-wolf-consort/presentation";
import { captureWolfSorcererPresentation } from "../../features/wolf-sorcerer/presentation";
import { captureTricksterPresentation } from "../../features/trickster/presentation";
import { captureOrderPrincePresentation } from "../../features/order-prince/presentation";
import { captureMagicianPresentation } from "../../features/magician/presentation";
import { captureRedMoonApostlePresentation } from "../../features/red-moon/presentation";
import { captureNightmarePresentation } from "../../features/nightmare/presentation";
import { captureEvilKnightPresentation } from "../../features/evil-knight/presentation";
import {
  capturePureWhiteGirlPresentation,
  captureWolfWitchPresentation,
} from "../../features/pure-white/presentation";
import { captureDemonHunterPresentation } from "../../features/demon-hunter/presentation";
import { captureGhostBridePresentation } from "../../features/ghost-bride/presentation";
import { captureWildChildPresentation } from "../../features/wild-child/presentation";
import { captureLonelyGirlPresentation } from "../../features/lonely-girl/presentation";
import { captureThiefPresentation } from "../../features/thief/presentation";
import { captureShapeshifterPresentation } from "../../features/shapeshifter/presentation";
import { captureWolfPresentation } from "../../features/wolf/presentation";
import { captureWolfKingPresentation } from "../../features/wolf-king/presentation";
import { captureWhiteWolfKingPresentation } from "../../features/white-wolf-king/presentation";
import { captureKnightPresentation } from "../../features/knight/presentation";
import { captureGravekeeperPresentation } from "../../features/gravekeeper/presentation";
import { captureDreamerPresentation } from "../../features/dreamer/presentation";
import { captureWolfBeautyPresentation } from "../../features/wolf-beauty/presentation";
import { captureBearPresentation } from "../../features/bear/presentation";
import { captureCursedFoxPresentation } from "../../features/cursed-fox/presentation";
import { captureCupidPresentation } from "../../features/cupid/presentation";
import { captureDebaterPresentation } from "../../features/debater/presentation";
import { captureHiddenWolfPresentation } from "../../features/hidden-wolf/presentation";
import { captureGargoylePresentation } from "../../features/gargoyle/presentation";
import { capturePsychicPresentation } from "../../features/psychic/presentation";
import { captureMechanicalWolfPresentation } from "../../features/mechanical-wolf/presentation";
import { captureMiracleMerchantPresentation } from "../../features/miracle-merchant/presentation";
import { captureBlackMarketMerchantPresentation } from "../../features/black-market-merchant/presentation";
import { captureHybridPresentation } from "../../features/hybrid/presentation";
import { captureMirrorGirlPresentation } from "../../features/mirror-girl/presentation";
import { captureAwakenedHiddenWolfPresentation } from "../../features/awakened-hidden-wolf/presentation";
import { captureVillagerPresentation } from "../../features/villager/presentation";
import { captureSeerPresentation } from "../../features/seer/presentation";
import { captureGuardPresentation } from "../../features/guard/presentation";
import { captureWitchPresentation } from "../../features/witch/presentation";
import { captureHunterPresentation } from "../../features/hunter/presentation";
import { captureIdiotPresentation } from "../../features/idiot/presentation";

/** 只选择捕获程序并传原引用；不把角色数据 shape、权限或快照策略藏进注册表。 */
const nativeCaptures: Record<
  NativeRolePresentationId,
  (
    role: RoleComponent,
    locale: Locale,
    world: World | undefined,
    currentCamp: CurrentCampSource,
  ) => string
> = {
  white_cat: captureWhiteCatPresentation,
  fox_cub: captureFoxCubPresentation,
  pufferfish: capturePufferfishPresentation,
  fragrant_phantom: captureFragrantPhantomPresentation,
  awakened_seer: captureAwakenedSeerPresentation,
  night_noble: captureNightNoblePresentation,
  awakened_idiot: captureAwakenedIdiotPresentation,
  radiant_count: captureRadiantCountPresentation,
  eclipse_maid: captureEclipseMaidPresentation,
  alchemist: captureAlchemistPresentation,
  raven_claw_wolf: captureRavenClawWolfPresentation,
  day_scholar: captureDayScholarPresentation,
  night_mentor: captureNightMentorPresentation,
  time_wolf_consort: captureTimeWolfConsortPresentation,
  wolf_sorcerer: captureWolfSorcererPresentation,
  trickster: captureTricksterPresentation,
  order_prince: captureOrderPrincePresentation,
  magician: captureMagicianPresentation,
  red_moon_apostle: captureRedMoonApostlePresentation,
  nightmare: captureNightmarePresentation,
  evil_knight: captureEvilKnightPresentation,
  pure_white_girl: capturePureWhiteGirlPresentation,
  wolf_witch: captureWolfWitchPresentation,
  demon_hunter: captureDemonHunterPresentation,
  ghost_bride: captureGhostBridePresentation,
  wild_child: captureWildChildPresentation,
  lonely_girl: captureLonelyGirlPresentation,
  thief: captureThiefPresentation,
  shapeshifter: captureShapeshifterPresentation,
  wolf: captureWolfPresentation,
  wolf_king: captureWolfKingPresentation,
  white_wolf_king: captureWhiteWolfKingPresentation,
  knight: captureKnightPresentation,
  gravekeeper: captureGravekeeperPresentation,
  dreamer: captureDreamerPresentation,
  wolf_beauty: captureWolfBeautyPresentation,
  bear: captureBearPresentation,
  cursed_fox: captureCursedFoxPresentation,
  cupid: captureCupidPresentation,
  debater: captureDebaterPresentation,
  hidden_wolf: captureHiddenWolfPresentation,
  gargoyle: captureGargoylePresentation,
  psychic: capturePsychicPresentation,
  mechanical_wolf: captureMechanicalWolfPresentation,
  miracle_merchant: captureMiracleMerchantPresentation,
  black_market_merchant: captureBlackMarketMerchantPresentation,
  hybrid: captureHybridPresentation,
  mirror_girl: captureMirrorGirlPresentation,
  awakened_hidden_wolf: captureAwakenedHiddenWolfPresentation,
  villager: captureVillagerPresentation,
  seer: captureSeerPresentation,
  guard: captureGuardPresentation,
  witch: captureWitchPresentation,
  hunter: captureHunterPresentation,
  idiot: captureIdiotPresentation,
};

export function captureNativeRolePresentation(
  id: NativeRolePresentationId,
  role: RoleComponent,
  locale: Locale,
  world: World | undefined,
  currentCamp: CurrentCampSource,
): string {
  // 不提前调用 source，也不归一化语言；具体捕获失败时保留已发生的读取前缀。
  return nativeCaptures[id](role, locale, world, currentCamp);
}
