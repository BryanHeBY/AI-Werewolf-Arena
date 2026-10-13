/**
 * 负责将十二个实际文案家族聚合成公开两语词典，MessageKey 清单仍由契约包拥有。
 * 输入为各家族参数表、中文／英文模板与原 MESSAGE_IDS 顺序；输出为普通原型、浅冻结字典，
 * 保留中文 literal 类型以及历史英文两组相邻 key 的顺序差异。
 * 聚合只在模块加载时检查仓库文案的 key 归属、占位及完整性，不解析事实、校验玩家输入
 * 或改变共享格式化器的缺失参数／用户原文政策。
 */
import { MESSAGE_IDS, type MessageKey } from "@ai-werewolf-arena/game-contract";
import { messages as common } from "./common";
import { messages as runtime } from "./runtime";
import { messages as agents } from "./agents";
import { messages as replay } from "./replay";
import { messages as audit } from "./audit";
import { messages as classic } from "./features/classic";
import { messages as identity } from "./features/identity";
import { messages as giftsrelations } from "./features/gifts-relations";
import { messages as nightmodifiers } from "./features/night-modifiers";
import { messages as mistradiant } from "./features/mist-radiant";
import { messages as noblefragrant } from "./features/noble-fragrant";
import { messages as animaldream } from "./features/animal-dream";

// 保留原片段读取顺序：它决定哪个重复 key 最先报错；它不决定公开中文 key 顺序。
const modules = [
  common,
  runtime,
  agents,
  replay,
  audit,
  classic,
  identity,
  giftsrelations,
  nightmodifiers,
  mistradiant,
  noblefragrant,
  animaldream,
] as const;

// 交集保留各中文片段的 literal 类型；英文公开类型只承诺相同 MessageKey 的 string 值。
type UnionToIntersection<T> = (T extends unknown ? (value: T) => void : never) extends (
  value: infer Intersection,
) => void
  ? Intersection
  : never;
type ChineseDictionary = UnionToIntersection<(typeof modules)[number]["zhCN"]>;
type EnglishDictionary = Record<MessageKey, string>;

const translations = new Map<MessageKey, { zhCN: string; en: string }>();
for (const module of modules) {
  const parameters: Readonly<Partial<Record<MessageKey, readonly string[]>>> =
    module.definition.parameters;
  const chinese: Readonly<Partial<Record<MessageKey, string>>> = module.zhCN;
  const english: Readonly<Partial<Record<MessageKey, string>>> = module.en;
  for (const key of Object.keys(parameters) as MessageKey[]) {
    // key 必须只有一个实际 owner；不能以 owner 标签相同或不同来绕过重复检查。
    if (translations.has(key)) throw new Error(`i18n_duplicate_owner: ${key}`);
    const expected = parameters[key]!;
    // 非空断言仅在编译期存在。仓库模板缺失时仍在 matchAll 原读取点失败，不补空串或 fallback。
    for (const template of [chinese[key]!, english[key]!]) {
      // 只收集字母开头的命名占位，去重并排序；expected 原数组必须已经规范，不在这里重排它。
      const actual = [
        ...new Set([...template.matchAll(/\{([a-zA-Z][a-zA-Z0-9_]*)\}/g)].map((match) => match[1])),
      ].sort();
      if (JSON.stringify(actual) !== JSON.stringify(expected))
        throw new Error(`i18n_definition_parameters_mismatch: ${key}`);
    }
    translations.set(key, { zhCN: chinese[key]!, en: english[key]! });
  }
}
// 所有片段检查完再核完整 closed ID 集；缺少 key 或混入额外 key 保留原失败前缀。
if (translations.size !== MESSAGE_IDS.length || MESSAGE_IDS.some((key) => !translations.has(key)))
  throw new Error("i18n_definition_key_set_mismatch");

// 英文历史上这两组相邻 key 与中文顺序相反，复制原 ID 顺序后只交换这两组位置。
// 不改 MESSAGE_IDS 或再建机器 ID 注册表，字典可观察的 key／descriptor 顺序保持原契约。
const englishOrder = [...MESSAGE_IDS];
for (const [first, second] of [
  ["console.judge.sheriff_candidates_none", "console.judge.sheriff_candidates"],
  [
    "config.warning.legacy_unsupported_windows_removed_explicitly",
    "config.warning.legacy_windows_with_disabled_hooks_removed_explicitly",
  ],
] as const) {
  const firstIndex = englishOrder.indexOf(first),
    secondIndex = englishOrder.indexOf(second);
  [englishOrder[firstIndex], englishOrder[secondIndex]] = [second, first];
}

// fromEntries 保留普通对象原型和原 data descriptor；冻结仅作用于最终字典，值是原字符串。
export const zhCN = Object.freeze(
  Object.fromEntries(
    MESSAGE_IDS.map((key) => [key, translations.get(key)!.zhCN]),
  ) as ChineseDictionary,
);
export const en = Object.freeze(
  Object.fromEntries(
    englishOrder.map((key) => [key, translations.get(key)!.en]),
  ) as EnglishDictionary,
);
