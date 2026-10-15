/**
 * 负责集中登记原有 55 个角色的三份贡献及原顺序。输入来自各机制的资料、运行与纯展示声明，
 * 输出为实际组合根使用的同一贡献对象；登记不执行初始化或展示，不调用 World、不复制库存。
 * 角色支持集合仍与既有运行集合一致，顺序不得由名称、文件系统或自动发现重排。
 */
import type { NativeRoleContributions } from "./contracts";
import {
  NIGHT_NOBLE_ROLE_PROFILE,
  AWAKENED_IDIOT_ROLE_PROFILE,
} from "../../features/noble-secret-body/profile";
import {
  WHITE_CAT_ROLE_PROFILE,
  FOX_CUB_ROLE_PROFILE,
  PUFFERFISH_ROLE_PROFILE,
} from "../../features/animal-dream/profile";
import {
  FRAGRANT_PHANTOM_ROLE_PROFILE,
  AWAKENED_SEER_ROLE_PROFILE,
} from "../../features/fragrant-pair-seer/profile";
import { SCHOLAR_ROLE_PROFILE, MENTOR_ROLE_PROFILE } from "../../features/scholar-mentor/profile";
import { ALCHEMIST_ROLE_PROFILE, RAVEN_CLAW_ROLE_PROFILE } from "../../features/mist-raven/profile";
import { TIME_CONSORT_ROLE_PROFILE } from "../../features/time-wolf-consort/profile";
import { WOLF_SORCERER_ROLE_PROFILE } from "../../features/wolf-sorcerer/profile";
import { TRICKSTER_ROLE_PROFILE } from "../../features/trickster/profile";
import { ORDER_PRINCE_ROLE_PROFILE } from "../../features/order-prince/profile";
import { MAGICIAN_ROLE_PROFILE } from "../../features/magician/profile";
import { RED_MOON_ROLE_PROFILE } from "../../features/red-moon/profile";
import { NIGHTMARE_SHADOW_ROLE_PROFILE } from "../../features/nightmare/profile";
import { EVIL_KNIGHT_ROLE_PROFILE } from "../../features/evil-knight/profile";
import { DEMON_HUNTER_ROLE_PROFILE } from "../../features/demon-hunter/profile";
import {
  PURE_WHITE_ROLE_PROFILE,
  WOLF_WITCH_ROLE_PROFILE,
} from "../../features/pure-white/profile";
import { GHOST_BRIDE_ROLE_PROFILE } from "../../features/ghost-bride/profile";
import { LONELY_GIRL_ROLE_PROFILE } from "../../features/lonely-girl/profile";
import { WILD_CHILD_ROLE_PROFILE } from "../../features/wild-child/profile";
import { SHAPESHIFTER_ROLE_PROFILE } from "../../features/shapeshifter/profile";
import { THIEF_ROLE_PROFILE } from "../../features/thief/profile";
import { GUARD_ROLE_PROFILE } from "../../features/guard/profile";
import { HUNTER_ROLE_PROFILE } from "../../features/hunter/profile";
import { IDIOT_ROLE_PROFILE } from "../../features/idiot/profile";
import { SEER_ROLE_PROFILE } from "../../features/seer/profile";
import { VILLAGER_ROLE_PROFILE } from "../../features/villager/profile";
import { WITCH_ROLE_PROFILE } from "../../features/witch/profile";
import { WOLF_ROLE_PROFILE } from "../../features/wolf/profile";
import { WOLF_KING_ROLE_PROFILE } from "../../features/wolf-king/profile";
import { WHITE_WOLF_KING_ROLE_PROFILE } from "../../features/white-wolf-king/profile";
import { KNIGHT_ROLE_PROFILE } from "../../features/knight/profile";
import { GRAVEKEEPER_ROLE_PROFILE } from "../../features/gravekeeper/profile";
import { DREAMER_ROLE_PROFILE } from "../../features/dreamer/profile";
import { WOLF_BEAUTY_ROLE_PROFILE } from "../../features/wolf-beauty/profile";
import { BEAR_ROLE_PROFILE } from "../../features/bear/profile";
import { HIDDEN_WOLF_ROLE_PROFILE } from "../../features/hidden-wolf/profile";
import { GARGOYLE_ROLE_PROFILE } from "../../features/gargoyle/profile";
import { PSYCHIC_ROLE_PROFILE } from "../../features/psychic/profile";
import { MECHANICAL_WOLF_ROLE_PROFILE } from "../../features/mechanical-wolf/profile";
import { BLACK_MARKET_MERCHANT_ROLE_PROFILE } from "../../features/black-market-merchant/profile";
import { MIRACLE_MERCHANT_ROLE_PROFILE } from "../../features/miracle-merchant/profile";
import { HYBRID_ROLE_PROFILE } from "../../features/hybrid/profile";
import { MIRROR_GIRL_ROLE_PROFILE } from "../../features/mirror-girl/profile";
import { AWAKENED_HIDDEN_WOLF_ROLE_PROFILE } from "../../features/awakened-hidden-wolf/profile";
import { CURSED_FOX_ROLE_PROFILE } from "../../features/cursed-fox/profile";
import { DEBATER_ROLE_PROFILE } from "../../features/debater/profile";
import { CUPID_ROLE_PROFILE } from "../../features/cupid/profile";
import {
  RADIANT_COUNT_ROLE_PROFILE,
  ECLIPSE_MAID_ROLE_PROFILE,
} from "../../features/radiant-eclipse/profile";

export const BUILTIN_ROLE_CONTRIBUTIONS: readonly NativeRoleContributions[] = [
  WHITE_CAT_ROLE_PROFILE,
  FOX_CUB_ROLE_PROFILE,
  PUFFERFISH_ROLE_PROFILE,
  FRAGRANT_PHANTOM_ROLE_PROFILE,
  AWAKENED_SEER_ROLE_PROFILE,
  NIGHT_NOBLE_ROLE_PROFILE,
  AWAKENED_IDIOT_ROLE_PROFILE,
  RADIANT_COUNT_ROLE_PROFILE,
  ECLIPSE_MAID_ROLE_PROFILE,
  ALCHEMIST_ROLE_PROFILE,
  RAVEN_CLAW_ROLE_PROFILE,
  SCHOLAR_ROLE_PROFILE,
  MENTOR_ROLE_PROFILE,
  TIME_CONSORT_ROLE_PROFILE,
  WOLF_SORCERER_ROLE_PROFILE,
  TRICKSTER_ROLE_PROFILE,
  ORDER_PRINCE_ROLE_PROFILE,
  MAGICIAN_ROLE_PROFILE,
  RED_MOON_ROLE_PROFILE,
  NIGHTMARE_SHADOW_ROLE_PROFILE,
  EVIL_KNIGHT_ROLE_PROFILE,
  PURE_WHITE_ROLE_PROFILE,
  WOLF_WITCH_ROLE_PROFILE,
  DEMON_HUNTER_ROLE_PROFILE,
  GHOST_BRIDE_ROLE_PROFILE,
  WILD_CHILD_ROLE_PROFILE,
  LONELY_GIRL_ROLE_PROFILE,
  THIEF_ROLE_PROFILE,
  SHAPESHIFTER_ROLE_PROFILE,
  WOLF_ROLE_PROFILE,
  WOLF_KING_ROLE_PROFILE,
  WHITE_WOLF_KING_ROLE_PROFILE,
  KNIGHT_ROLE_PROFILE,
  GRAVEKEEPER_ROLE_PROFILE,
  DREAMER_ROLE_PROFILE,
  WOLF_BEAUTY_ROLE_PROFILE,
  BEAR_ROLE_PROFILE,
  CURSED_FOX_ROLE_PROFILE,
  CUPID_ROLE_PROFILE,
  DEBATER_ROLE_PROFILE,
  HIDDEN_WOLF_ROLE_PROFILE,
  GARGOYLE_ROLE_PROFILE,
  PSYCHIC_ROLE_PROFILE,
  MECHANICAL_WOLF_ROLE_PROFILE,
  MIRACLE_MERCHANT_ROLE_PROFILE,
  BLACK_MARKET_MERCHANT_ROLE_PROFILE,
  HYBRID_ROLE_PROFILE,
  MIRROR_GIRL_ROLE_PROFILE,
  AWAKENED_HIDDEN_WOLF_ROLE_PROFILE,
  VILLAGER_ROLE_PROFILE,
  SEER_ROLE_PROFILE,
  GUARD_ROLE_PROFILE,
  WITCH_ROLE_PROFILE,
  HUNTER_ROLE_PROFILE,
  IDIOT_ROLE_PROFILE,
];
