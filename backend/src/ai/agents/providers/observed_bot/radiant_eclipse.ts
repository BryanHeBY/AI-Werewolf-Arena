import type { ObservedToolHandler } from "./context";
/** Strategies use only the explicit per-request player DTO candidate lists. */
export const castShelter: ObservedToolHandler = ({ request, pick, style, random }) => ({
  name: "cast_shelter",
  args: {
    target_id:
      style === "conservative" || (style === "random" && random.next() < 0.35)
        ? null
        : (pick([...(request.context.shelter_candidates ?? [])]) ?? null),
  },
});
export const swallowSkill: ObservedToolHandler = ({ request, pick, style, random }) => ({
  name: "swallow_skill",
  args: {
    target_id:
      style === "conservative" || (style === "random" && random.next() < 0.35)
        ? null
        : (pick([...(request.context.swallow_candidates ?? [])]) ?? null),
  },
});
