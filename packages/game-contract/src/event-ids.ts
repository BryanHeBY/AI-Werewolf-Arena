/**
 * Owns stable event-pack, event and item IDs consumed by public configuration.
 * Inputs are declared protocol values; outputs are the existing one-item lists.
 * Catalog metadata and ruleset support decide what can run; these IDs grant no
 * permission and contain no event implementation or text.
 */
export const EVENT_PACK_IDS = ["awa_wall_notes_once_v1"] as const;
export const EVENT_IDS = ["awa_wall_notes_v1"] as const;
export const ITEM_IDS = ["anonymous_note"] as const;
