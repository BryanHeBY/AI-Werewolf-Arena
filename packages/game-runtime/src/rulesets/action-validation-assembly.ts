/**
 * 负责可信请求准入贡献的固定装配与 scope 所属身份。身份只路由原证明，不授予行动。
 * 输入为具体本族定义，输出保原 raw 政策顺序和十次 scope 观察顺序；不保存 World、许可或资源。
 * 模块只建立静态身份，实际定义只加载各本族验证 owner，不提前装配 profile／阶段时钟。
 */
import type { TrustedRequestAdmission } from "../engine/actions/validation-queries";
export const THIEF_VALIDATION_SCOPE = {};
export const SHAPESHIFTER_VALIDATION_SCOPE = {};
export const LONELY_GIRL_VALIDATION_SCOPE = {};
export const GHOST_BRIDE_VALIDATION_SCOPE = {};
export const DEMON_HUNTER_VALIDATION_SCOPE = {};
export const NOBLE_BODY_VALIDATION_SCOPE = {};
export const FRAGRANT_PAIR_VALIDATION_SCOPE = {};
export const ANIMAL_VALIDATION_SCOPE = {};
export const WILD_CHILD_VALIDATION_SCOPE = {};
export const WALL_VALIDATION_SCOPE = {};
export function createDefaultActionValidationAssembly() {
  // 显式自定义 Catalog／规则不因构造 Registry 就加载其余角色 profile；仅真正 raw／scope 消费才取对应定义。
  const initial = () =>
    require("../features/initial-identity/validation-rules") as typeof import("../features/initial-identity/validation-rules");
  const lonely = () =>
    require("../features/lonely-girl/validation-rules") as typeof import("../features/lonely-girl/validation-rules");
  const ghost = () =>
    require("../features/ghost-bride/validation-rules") as typeof import("../features/ghost-bride/validation-rules");
  const demon = () =>
    require("../features/demon-hunter/validation-rules") as typeof import("../features/demon-hunter/validation-rules");
  const noble = () =>
    require("../features/noble-secret-body/validation-rules") as typeof import("../features/noble-secret-body/validation-rules");
  const fragrant = () =>
    require("../features/fragrant-pair-seer/validation-rules") as typeof import("../features/fragrant-pair-seer/validation-rules");
  const animal = () =>
    require("../features/animal-dream/validation-rules") as typeof import("../features/animal-dream/validation-rules");
  const wild = () =>
    require("../features/wild-child/validation-rules") as typeof import("../features/wild-child/validation-rules");
  const wall = () =>
    require("../features/wall-notes/validation-rules") as typeof import("../features/wall-notes/validation-rules");
  return {
    get scopes(): readonly TrustedRequestAdmission[] {
      return [
        initial().THIEF_REQUEST_ADMISSION,
        initial().SHAPESHIFTER_REQUEST_ADMISSION,
        lonely().LONELY_GIRL_REQUEST_ADMISSION,
        ghost().GHOST_BRIDE_REQUEST_ADMISSION,
        demon().DEMON_REQUEST_ADMISSION,
        noble().NOBLE_BODY_REQUEST_ADMISSION,
        fragrant().FRAGRANT_PAIR_REQUEST_ADMISSION,
        animal().ANIMAL_REQUEST_ADMISSION,
        wild().WILD_CHILD_REQUEST_ADMISSION,
        wall().WALL_REQUEST_ADMISSION,
      ];
    },
    get raw(): readonly TrustedRequestAdmission[] {
      return [
        wall().WALL_REQUEST_ADMISSION,
        initial().THIEF_REQUEST_ADMISSION,
        lonely().LONELY_GIRL_REQUEST_ADMISSION,
        wild().WILD_CHILD_REQUEST_ADMISSION,
        ghost().GHOST_BRIDE_REQUEST_ADMISSION,
        demon().DEMON_REQUEST_ADMISSION,
      ];
    },
    get commonRules() {
      return wall().WALL_VALIDATION_RULES;
    },
  };
}
