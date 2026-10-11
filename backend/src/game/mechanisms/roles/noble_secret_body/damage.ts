import { types } from "node:util";
/** Finite AWA Noble board only. Input is the FINAL valid sources after rescue,
 * native toxin immunity and hunt/servant clearing; this function owns no resource. */
export const SECRET_BODY_CAUSE_ORDER = Object.freeze([
  "wolf_kill",
  "poison",
  "demon_hunt",
  "demon_hunt_backlash",
  "servant_expiry",
] as const);
export type SecretBodyCause = (typeof SECRET_BODY_CAUSE_ORDER)[number];
export type SecretBodySources = Readonly<Record<string, readonly SecretBodyCause[]>>;
function playerId(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0 && value < Number.MAX_SAFE_INTEGER;
}
export function planSecretBodyBlock(
  actorId: number,
  selectedId: number | null,
  sources: SecretBodySources,
): Readonly<{
  blocked: Readonly<{ targetId: number; cause: SecretBodyCause }> | null;
  sources: SecretBodySources;
}> {
  if (!playerId(actorId) || (selectedId !== null && !playerId(selectedId)))
    throw new Error("secret_body_target_invalid");
  const copied: Record<string, SecretBodyCause[]> = {};
  if (
    !sources ||
    typeof sources !== "object" ||
    types.isProxy(sources) ||
    Array.isArray(sources) ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(sources))
  )
    throw new Error("secret_body_sources_invalid");
  const fields = Object.getOwnPropertyDescriptors(sources);
  for (const key of Reflect.ownKeys(fields)) {
    const field = typeof key === "string" ? fields[key] : undefined;
    if (
      !field ||
      !("value" in field) ||
      typeof key !== "string" ||
      !playerId(Number(key)) ||
      String(Number(key)) !== key
    )
      throw new Error("secret_body_sources_invalid");
    const raw: unknown = field.value;
    if (types.isProxy(raw) || !Array.isArray(raw) || Object.getPrototypeOf(raw) !== Array.prototype)
      throw new Error("secret_body_sources_invalid");
    const items: Record<string, PropertyDescriptor> = Object.getOwnPropertyDescriptors(
      raw as object,
    );
    const length: unknown = items.length?.value;
    if (
      typeof length !== "number" ||
      !Number.isSafeInteger(length) ||
      length < 0 ||
      Reflect.ownKeys(items).length !== length + 1
    )
      throw new Error("secret_body_sources_invalid");
    const causes: SecretBodyCause[] = [];
    for (let index = 0; index < length; index++) {
      const item = items[String(index)];
      if (
        !item ||
        !("value" in item) ||
        !SECRET_BODY_CAUSE_ORDER.includes(item.value) ||
        causes.includes(item.value)
      )
        throw new Error("secret_body_sources_invalid");
      causes.push(item.value);
    }
    if (causes.length) copied[key] = causes;
  }
  const preferred = selectedId ?? actorId;
  const targetId = copied[String(preferred)]?.length ? preferred : actorId;
  const causes = copied[String(targetId)] ?? [];
  const cause = SECRET_BODY_CAUSE_ORDER.find((c) => causes.includes(c));
  if (cause) {
    copied[String(targetId)] = causes.filter((c) => c !== cause);
    if (!copied[String(targetId)]!.length) delete copied[String(targetId)];
  }
  return Object.freeze({
    blocked: cause ? Object.freeze({ targetId, cause }) : null,
    sources: Object.freeze(
      Object.fromEntries(Object.entries(copied).map(([key, value]) => [key, Object.freeze(value)])),
    ),
  });
}
