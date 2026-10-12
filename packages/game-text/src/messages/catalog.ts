/**
 * Owns assembly of built-in translation fragments into the public dictionaries.
 * Inputs are uniquely owned neutral definitions, their two language templates,
 * and game-contract's existing ordered IDs; outputs are ordinary-prototype,
 * shallow-frozen dictionaries with the historical key/value/descriptor order.
 * Assembly checks repository-owned completeness and placeholder consistency,
 * never player input, game facts, board support, or formatter failure policy.
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
    if (translations.has(key)) throw new Error(`i18n_duplicate_owner: ${key}`);
    const expected = parameters[key]!;
    for (const template of [chinese[key]!, english[key]!]) {
      const actual = [
        ...new Set([...template.matchAll(/\{([a-zA-Z][a-zA-Z0-9_]*)\}/g)].map((match) => match[1])),
      ].sort();
      if (JSON.stringify(actual) !== JSON.stringify(expected))
        throw new Error(`i18n_definition_parameters_mismatch: ${key}`);
    }
    translations.set(key, { zhCN: chinese[key]!, en: english[key]! });
  }
}
if (translations.size !== MESSAGE_IDS.length || MESSAGE_IDS.some((key) => !translations.has(key)))
  throw new Error("i18n_definition_key_set_mismatch");

// English historically put these two neighboring pairs in the opposite order.
// Keep that observable order without introducing another machine ID registry.
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
