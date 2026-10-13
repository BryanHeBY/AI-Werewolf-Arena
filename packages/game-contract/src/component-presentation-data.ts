/**
 * 负责定义公开组件的纯展示数据片段。输入为在原读取点已选出的状态、阵营或标量；输出
 * 不携带组件、World、访问器或库存。片段立即格式化，不能提前捕获后段字段而改变
 * getter 与故障前缀；语言和文案不授予生命、投票、警徽或印记修改权限。
 */
import type { Camp, StatusMark } from "./identity";

export type ComponentPresentationPart =
  | { readonly kind: "alive"; readonly alive: boolean }
  | { readonly kind: "camp"; readonly camp: Camp }
  | { readonly kind: "badge-destroyed" }
  | { readonly kind: "badge-none" }
  | { readonly kind: "badge-held"; readonly weight: number }
  | { readonly kind: "vote-none" }
  | { readonly kind: "vote-weight"; readonly weight: number }
  | { readonly kind: "marks-none" }
  | { readonly kind: "mark"; readonly mark: StatusMark }
  | { readonly kind: "marks"; readonly marks: string };
