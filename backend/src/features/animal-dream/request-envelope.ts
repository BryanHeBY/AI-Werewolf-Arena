/**
 * 负责动物梦境请求信封的私有绑定、数据快照、别名和最早期限。输入为原请求／World 与调度器副本；
 * 输出为不透明 token、冻结元数据和当前性结果。严格数据 schema 与 plain-data 快照在此核对，
 * 原 context 必须同引用，已登记任一信封失配或观察到期会永久撤回共同信封。
 * 写入仅限私有信封／别名表及共享预算、withdrawn；显式撤回或观察到失效会关闭信封，不因字段恢复重开。
 * 这里只持请求数据能力，不调用 provider／控制器，不替代实际领域选择和库存许可。
 */
import { types } from "node:util";
import { z } from "zod";
import { snapshotPlainData } from "../../domain/plain-data";
import type { World } from "../../domain/world";

type Kind = "fox" | "puffer";
interface Header {
  readonly kind: Kind;
  readonly actorId: number;
  readonly day: number;
  readonly candidates: readonly number[] | null;
}
interface Alias {
  readonly request: object;
  readonly context: object;
  readonly deadline: number | undefined;
}
/** 请求正文只排除期限编码；aliases 共享预算和 withdrawn，任一已登记项失配都会撤共同信封。 */
interface Envelope {
  readonly world: World;
  readonly original: Alias;
  readonly body: string;
  readonly header: Header;
  readonly aliases: Map<object, Alias>;
  deadline: number | null;
  withdrawn: boolean;
}
const envelopes = new WeakMap<object, Envelope>();
const now = Date.now.bind(Date);
const id = z.number().int().positive().safe(),
  names = z.enum(["fox_distract", "puffer_retaliate"]),
  requestSchema = z.strictObject({
    phase: z.enum(["night", "voting"]),
    actorId: id,
    allowedTools: z.array(names).length(1),
    context: z.looseObject({
      day: z.number().int().positive().safe(),
      stage: z.enum(["fox_distract", "puffer_reaction"]),
      allow_fallback: z.literal(false),
      action_failure_policy: z.literal("error"),
      visible_events: z.array(z.unknown()),
      turn_constraints: z.looseObject({
        min_valid_actions: z.literal(1),
        max_valid_actions: z.literal(1),
        required_any_tools: z.array(names).length(1),
      }),
      fox_candidates: z
        .array(id)
        .min(1)
        .max(12)
        .refine((ids) => ids.every((v, i) => i === 0 || ids[i - 1]! < v))
        .optional(),
    }),
  });
function own(value: unknown, key: string): unknown {
  if (!value || typeof value !== "object" || types.isProxy(value)) return undefined;
  const d = Object.getOwnPropertyDescriptor(value, key);
  return d && "value" in d ? d.value : undefined;
}
function body(request: object): string | null {
  try {
    const data = snapshotPlainData(request, new Set(), 0, 1048576);
    if (!data || typeof data !== "object" || Array.isArray(data)) return null;
    return JSON.stringify(
      Object.fromEntries(Object.entries(data).filter(([key]) => key !== "deadlineAtMs")),
    );
  } catch {
    return null;
  }
}
function validDeadline(value: unknown): value is number | undefined {
  return (
    value === undefined || (typeof value === "number" && Number.isFinite(value) && value > now())
  );
}
/** 捕获动物请求的数据能力；不执行控制器、provider、阶段或 caller 回调，资源 owner 在其末次守卫后调用。 */
export function captureAnimalRequestEnvelope(world: World, request: object): object {
  const encoded = body(request),
    context = own(request, "context"),
    deadline = own(request, "deadlineAtMs");
  if (!encoded || !context || typeof context !== "object" || !validDeadline(deadline))
    throw Error("animal_request_envelope_invalid");
  const parsed = requestSchema.safeParse(JSON.parse(encoded));
  if (!parsed.success) throw Error("animal_request_envelope_invalid");
  const data = parsed.data,
    c = data.context,
    kind: Kind = data.allowedTools[0] === "fox_distract" ? "fox" : "puffer";
  if (
    data.phase !== (kind === "fox" ? "night" : "voting") ||
    c.stage !== (kind === "fox" ? "fox_distract" : "puffer_reaction") ||
    c.turn_constraints.required_any_tools[0] !== data.allowedTools[0]
  )
    throw Error("animal_request_envelope_invalid");
  const candidates = kind === "fox" ? (c.fox_candidates ?? null) : null;
  if (kind === "fox" ? !candidates?.includes(data.actorId) : c.fox_candidates !== undefined)
    throw Error("animal_request_envelope_invalid");
  const token = Object.freeze({}),
    alias: Alias = { request, context, deadline },
    header: Header = Object.freeze({
      kind,
      actorId: data.actorId,
      day: c.day,
      candidates: candidates === null ? null : Object.freeze([...candidates]),
    });
  envelopes.set(token, {
    world,
    original: alias,
    body: encoded,
    header,
    aliases: new Map([[request, alias]]),
    deadline: deadline ?? null,
    withdrawn: false,
  });
  return token;
}
export function animalRequestEnvelopeMatchesWorld(token: object, world: World): boolean {
  return envelopes.get(token)?.world === world;
}
/** 返回与请求分离的冻结元数据；真实性仍由私有信封表核对，header 本身不是行动许可。 */
export function animalRequestEnvelopeHeader(token: object): Header | null {
  return envelopes.get(token)?.header ?? null;
}
export function animalRequestEnvelopeCurrent(token: object): boolean {
  const e = envelopes.get(token);
  if (!e || e.withdrawn) return false;
  if (e.deadline !== null && e.deadline <= now()) {
    e.withdrawn = true;
    return false;
  }
  // 先核观察到期，再逐个原对象／context／正文，末尾再读时钟；已撤回不因字段恢复或回拨而复活。
  for (const a of e.aliases.values()) {
    if (
      own(a.request, "context") !== a.context ||
      own(a.request, "deadlineAtMs") !== a.deadline ||
      body(a.request) !== e.body
    ) {
      e.withdrawn = true;
      return false;
    }
  }
  if (e.deadline !== null && e.deadline <= now()) {
    e.withdrawn = true;
    return false;
  }
  return true;
}
/** 返回本地绑定的期限数据；null／数值都不能替代完整 current 检查，也不是密码学签名。 */
export function animalRequestEnvelopeDeadline(token: object): number | null {
  return envelopes.get(token)?.deadline ?? null;
}
/** 调度别名必须共享原 context 同引用；成功登记只缩短预算，非法别名在写表前抛原错误。 */
export function inheritAnimalRequestEnvelope(token: object, original: object, clone: object): void {
  const e = envelopes.get(token),
    deadline = own(clone, "deadlineAtMs");
  if (
    !e ||
    !e.aliases.has(original) ||
    e.aliases.has(clone) ||
    !animalRequestEnvelopeCurrent(token) ||
    own(clone, "context") !== e.original.context ||
    body(clone) !== e.body ||
    typeof deadline !== "number" ||
    !validDeadline(deadline) ||
    (e.deadline !== null && deadline > e.deadline)
  )
    throw Error("animal_request_envelope_alias_invalid");
  e.aliases.set(clone, { request: clone, context: e.original.context, deadline });
  e.deadline = deadline;
}
export function revokeAnimalRequestEnvelope(token: object): void {
  const e = envelopes.get(token);
  if (e) e.withdrawn = true;
}
