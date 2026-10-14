/**
 * 负责执行和复现共用的玩家发言清洗。输入为原发言字符串，输出移除开头保留称谓并 trim 后的正文。
 * 仅处理文本展示约定；不判断发言权限、身份或动作是否合法。
 */
// 正则锚定开头，可连续去除保留称谓；英文大小写不敏感，正文中间的同类文字仍保留。
const RESERVED_PREFIX = /^(\s*\[(上帝|法官|系统|God|Judge|System)\]\s*)+/gi;
/** 保持原字符串 replace → trim 次序；不额外作 String 转换或吞掉原方法调用的异常。 */
export function sanitizeSpeechText(raw: string): string {
  return raw.replace(RESERVED_PREFIX, "").trim();
}
