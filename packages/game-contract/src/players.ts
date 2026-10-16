/**
 * 负责定义公开玩家资料契约。输入为调用方的编号、座位与可选昵称，输出为纯数据类型。
 * 不携带角色、阵营、人设或接入配置，不运行身份查询、行动授权或姓名渲染。
 */
export interface PublicPlayerIdentity {
  readonly id: number;
  readonly seat: number;
  /** 缺省表示未配置昵称；不能根据默认显示文本猜测用户是否取名。 */
  readonly name?: string;
}
