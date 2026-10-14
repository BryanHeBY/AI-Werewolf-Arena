/**
 * 负责鬼魂新娘原资源槽、参与者私态引用证据和安全审计数据的构造、读取及写入。
 * 输入为原角色／绑定上的数据字段与原编码函数；输出保留原槽引用、脱离的数据或原异常。
 * 公共字段与 schema 仍归共享契约；这里不持有 World、回合、婚约或第二份 live store。
 * 数据写入不授予选择许可；原生命、身份、请求和阶段复验仍由婚礼 authority 在原时点完成。
 * 写入失败保留已发生的字段前缀，取消只按原条件耗尽 remaining，不退款或修复被替换的槽。
 */
import { types } from "node:util";
import { freshGhostBrideState } from "@ai-werewolf-arena/game-contract/facts/ghost-bride";
import type { GhostBrideState, WeddingPair } from "@ai-werewolf-arena/game-contract/facts/ghost-bride";
import type { RoleInitializationComponent } from "../contracts";

// 同一原数据 reader：返回脱离副本／null，不能据此取得婚礼授权或原槽写权。
export { readGhostBrideState } from "@ai-werewolf-arena/game-contract/facts/ghost-bride";

/** 这些字段继续放在原 Participant 上；引用证据与 JSON 内容证据分别核对，不建镜像。 */
export interface GhostBrideParticipantData {
  state: object;
  stateRefs: ReadonlyArray<readonly [string, unknown]>;
  initialPrivateState: unknown;
  expectedPrivateJson: string;
  auditPrivateJson: string;
}

interface GhostBrideResourceData {
  state: GhostBrideState;
}

/** 初始化先读取左侧 privateState，再调用原默认工厂；赋值失败不增加补偿。 */
export function initializeGhostBrideState(role: RoleInitializationComponent): void {
  role.privateState.ghostBride = freshGhostBrideState();
}

/** 仅原 own data／writable 检查；不额外拒绝 Proxy、校验 schema 或执行被替换的 getter。 */
export function ghostBrideStateWritable(state: object, key: string): boolean {
  const d = Object.getOwnPropertyDescriptor(state, key);
  return !!d && Object.hasOwn(d, "value") && d.writable === true;
}

/** 当前参与者原字段校验通过后才枚举引用并复制初态；完整阵容检查仍随后由 authority 执行，snapshot 保留原编码规则。 */
export function captureGhostBrideParticipantData(
  state: object,
  privateJson: string,
  snapshot: (value: unknown) => unknown,
): GhostBrideParticipantData {
  return {
    state,
    stateRefs: Object.entries(state),
    initialPrivateState: snapshot(state),
    expectedPrivateJson: privateJson,
    auditPrivateJson: privateJson,
  };
}

/** 原 Proxy 拒绝与 descriptor 捕获先于 World 身份查询；不执行容器 accessor。 */
export function ghostBridePrivateFields(p: GhostBrideParticipantData): PropertyDescriptorMap | null {
  if (types.isProxy(p.state)) return null;
  const fields = Object.getOwnPropertyDescriptors(p.state);
  return fields;
}

/** Role／privateState 原身份已核后才比较键数和各原字段引用；JSON 相等不足以续权。 */
export function ghostBridePrivateRefsCurrent(
  p: GhostBrideParticipantData,
  fields: PropertyDescriptorMap,
): boolean {
  return (
    Object.keys(fields).length === p.stateRefs.length &&
    p.stateRefs.every(
      ([k, v]) => fields[k] && Object.hasOwn(fields[k], "value") && fields[k]!.value === v,
    )
  );
}

/**
 * encoded 在原身体／身份复验之前形成，本命令只在复验通过后调用。
 * 设置期还须等于初始／已提交 JSON；其余时点允许原 nested 库存变化，逐参与者更新安全审计串。
 */
export function acceptGhostBrideParticipantAudit(
  p: GhostBrideParticipantData,
  encoded: string | null,
  setup: boolean,
): boolean {
  if (encoded === null || (setup && encoded !== p.expectedPrivateJson)) return false;
  p.auditPrivateJson = encoded;
  return true;
}

/** 原回执与关闭字段先处理，再到这里条件耗尽资源；两次 state 读取均保留原位置。 */
export function closeGhostBrideResource(b: GhostBrideResourceData): void {
  if (ghostBrideStateWritable(b.state, "remaining")) b.state.remaining = 0;
}

/** 原 pair 已冻结但尚未安装；先耗尽 remaining，再写 groomId，后写失败不撤销前写。 */
export function consumeGhostBrideChoice(b: GhostBrideResourceData, id: number): void {
  b.state.remaining = 0;
  b.state.groomId = id;
}

/** 两次 participants.get 与 JSON 的原顺序保留；婚约、Victory 与 status 均已由 authority 写完。 */
export function updateGhostBrideExpectedData(
  b: { participants: ReadonlyMap<number, GhostBrideParticipantData>; actorId: number },
  json: (value: unknown) => string | null,
): void {
  b.participants.get(b.actorId)!.expectedPrivateJson = json(
    b.participants.get(b.actorId)!.state,
  )!;
}

/** 失败审计仅在原身体／身份仍有效时调用；不可编码则保留该参与者最近的安全串。 */
export function refreshGhostBrideParticipantAudit(
  p: GhostBrideParticipantData,
  json: (value: unknown) => string | null,
): void {
  const encoded = json(p.state);
  if (encoded !== null) p.auditPrivateJson = encoded;
}

/** 新娘失败视图合成耗尽字段而不写槽；其他参与者解码安全串，groom 仍在该分支现场读取。 */
export function projectGhostBrideFailedPrivateData(
  b: { actorId: number; pair: Readonly<WeddingPair> | null },
  p: GhostBrideParticipantData,
  id: number,
): Record<string, unknown> {
  return id === b.actorId
    ? {
        ghostBride: {
          ...freshGhostBrideState(),
          remaining: 0,
          groomId: b.pair?.groomId ?? null,
        },
      }
    : (JSON.parse(p.auditPrivateJson) as Record<string, unknown>);
}
