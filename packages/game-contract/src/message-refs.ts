/**
 * 负责请求与档案机器字段使用的中立消息引用结构；输入为封闭 MessageKey 和可选 string／number 参数，
 * 输出保留原引用形状，不在此渲染文案或替换调用方／用户／模型原文。
 * 缺失、多余及非有限参数由实际文案格式化器验证；类型不创建运行许可或强制执行提示。
 * readonly 只是声明约束，不复制参数、深冻结数据或验证未知输入。
 */
import type { MessageKey } from "./message-ids";

export interface MessageRef {
  key: MessageKey;
  /** 可选参数仍保 string／number 宽度；是否有限及与 key 匹配须在渲染点验证。 */
  parameters?: Readonly<Record<string, string | number>>;
}
