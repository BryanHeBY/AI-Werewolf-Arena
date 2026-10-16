/**
 * 负责玩家身份数据构造及可选昵称字段的数据来源校验；输入为编号、座位与显示名，输出新组件或字段合法性。
 * 构造参数不在此规范化；昵称校验只检查字段形态，身份安装、编号唯一性及会话授权仍由调用方负责。
 * 稳定会话标识用于关联记录，不是可序列化的行动凭据或跨局唯一认证。
 */
import { EntityId } from "../model";
import { types } from "node:util";

/**
 * 玩家身份组件：记录实体 ID、座位号、显示名与会话 ID。
 */
export interface IdentityComponent {
  id: EntityId;
  seat: number;
  /** 只保存显式昵称；缺省标签由展示层根据编号与语言生成。 */
  name?: string;
  sessionId: string;
}

/**
 * 昵称只能是自身的字符串数据字段，或普通身份对象上真正缺席的字段。
 * 不调用 getter；显式 undefined、继承值和代理不能冒充“未取名”。其余身份字段及原体仍由机制校验。
 */
export function hasValidOptionalPlayerName(identity: unknown): boolean {
  if (!identity || typeof identity !== "object" || types.isProxy(identity)) return false;
  const field = Object.getOwnPropertyDescriptor(identity, "name");
  if (field) return "value" in field && typeof field.value === "string";
  const prototype = Object.getPrototypeOf(identity);
  return prototype === Object.prototype || prototype === null;
}

/**
 * 按原字段顺序构造身份；不读取 World 或安装组件。
 */
export function createIdentityComponent(
  id: EntityId,
  seat: number,
  name?: string,
): IdentityComponent {
  return {
    id,
    seat,
    ...(name !== undefined ? { name } : {}),
    // 同实体编号产生同样的记录标识；不要把这个字符串用作真实会话权限。
    sessionId: `player_${id}`,
  };
}
