/**
 * 负责玩家身份数据的构造；输入实体编号、座位与显示名，输出新的可写组件对象。
 * 原参数不在此校验或规范化；身份安装、编号唯一性及会话授权由调用方负责。
 * 稳定会话标识用于关联记录，不是可序列化的行动凭据或跨局唯一认证。
 */
import { EntityId } from "../model";

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
