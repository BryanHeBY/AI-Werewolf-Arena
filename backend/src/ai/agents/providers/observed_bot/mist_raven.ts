import type { ObservedToolHandler } from "./context";

export const castMist: ObservedToolHandler = ({ request, pick, style, random }) => {
  if (
    (style === "conservative" && request.context.day === 1) ||
    (style === "random" && random.next() < 0.5)
  )
    return { name: "cast_mist", args: { target_ids: null } };
  const pool = [...(request.context.mist_candidates ?? [])],
    targets: number[] = [];
  while (pool.length && targets.length < 3) {
    const id = pick(pool)!;
    targets.push(id);
    pool.splice(pool.indexOf(id), 1);
  }
  return { name: "cast_mist", args: { target_ids: targets.length === 3 ? targets : null } };
};
export const useSnake: ObservedToolHandler = ({ request, style, random }) => ({
  name: "use_snake",
  args: {
    target_id:
      style === "conservative" ||
      (style === "competitive" && request.context.day === 1) ||
      (style === "random" && random.next() < 0.5)
        ? null
        : (request.context.snake_candidates?.[0] ?? null),
  },
});
export const ravenKnife: ObservedToolHandler = ({ request, pick, style, random }) => ({
  name: "raven_knife",
  args: {
    target_id:
      style === "conservative" || (style === "random" && random.next() < 0.5)
        ? null
        : (pick([...(request.context.raven_candidates ?? [])]) ?? null),
  },
});
