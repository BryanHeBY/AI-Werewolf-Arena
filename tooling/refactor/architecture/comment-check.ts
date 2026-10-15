/**
 * 负责检查首个源码语句之前的第一份有效职责说明。输入为 JS／TS 文本和公开文档路径名；
 * 输出为缺头、占位、类别字段或已知链接目标违规，不按注释数量判验收。
 * 检查只核 AST／注释位置与职责词项形状；真实写权、失败政策、生命周期和说明内容仍须独立人工审查。
 * 这里不执行源码、不读取文档内容或授予任何业务权限，语法合格的职责头不等于完整架构或玩法验收。
 */
import path from "node:path";
import type * as TypeScript from "typescript";
import {
  isTypedSource,
  parseSource,
  violation,
  type ArchitectureInput,
  type ArchitectureViolation,
} from "./contracts";

type Category = "behavior" | "test" | "data" | "lifecycle" | "adapter" | "exports" | "hook";
// 类别按原路径优先级决定，测试／生命周期等先匹配；不依据正文猜模块职责或改变规则。
export function commentCategory(file: string): Category {
  if (/\.(?:test|spec)\.[cm]?[jt]sx?$/.test(file) || /\/tests\/(?:support|fixtures)\//.test(file))
    return "test";
  if (
    /\/(?:authority|lifecycle|requests|lease|request[-_]envelope|request[-_]delivery|session[-_]pool|session[-_]lifecycle)\.[cm]?[jt]s$/.test(
      file,
    )
  )
    return "lifecycle";
  if (/\/(?:integrations|adapters)\//.test(file)) return "adapter";
  if (/\/(?:contracts|[^/]*schema|[^/]*state|[^/]*types)\.[cm]?[jt]s$/.test(file)) return "data";
  if (/\/index\.[cm]?[jt]s$/.test(file)) return "exports";
  if (/\/hooks?\/|\/(?:ports|[^/]*hook)\.[cm]?[jt]s$/.test(file)) return "hook";
  return "behavior";
}
const concepts = {
  responsibility:
    /responsib|own|provid|manag|implement|compar|freez|inventor|check|validat|verif|\btests?\b|define|describ|expos|derive|record|project|adapt|collect|build|generat|load|read|orchestrat|render|parse|负责|提供|实现|管理|校验|验证|盘点|整理|建立|解析|渲染|测试/i,
  input: /\binputs?\b|\bfrom\b|receiv|accept|输入|接收|来源|从|消费/i,
  output:
    /\boutputs?\b|\breturn|\bresult|\bproduc|\bemit|\bwrite|\bexport|输出|返回|产生|发布|生成|导出|写入/i,
  boundary:
    /boundar|\bonly\b|\bnever\b|\bwithout\b|\bnot\b|\bno\b|separat|边界|不|仅|只|禁止|独立|协作/i,
  owner: /\bowner|\bowns?\b|owned|权威|所属|所有者|拥有|负责/i,
  structure: /structur|\bdata\b|\bschema\b|\brecord|\bcontract|数据|结构|契约|字段|格式/i,
  layer: /\bunit\b|integration|scenario|architecture|\btest|测试|单元|集成|场景|验证层级/i,
  oracle: /oracle|fixture|literal|expect|independent|断言|预期|字面|独立|来源|样本/i,
  write: /\bwrite|\bmutat|\bcommit|\bcreate|\bclose|\bown|写权|写入|修改|提交|创建|关闭|所有者/i,
  invariant: /invariant|\bonly\b|\bmust\b|\bnever\b|monoton|不变量|必须|始终|单调|仅|禁止/i,
  terminal:
    /terminal|fail|cancel|abort|retir|withdraw|closed|stop|终态|失败|取消|撤权|关闭|中止|失效/i,
  sideEffect:
    /side.effect|\bprocess|\bnetwork|\btransport|\bfile|\bprotocol|\bsession|副作用|进程|网络|传输|文件|协议|会话/i,
  deadline: /deadline|budget|timeout|期限|预算|超时/i,
  cancellation: /cancel|\bclose|reclaim|取消|关闭|回收/i,
  consumer: /consumer|consum|\bpublic|\bbackend|\bfrontend|调用方|消费者|消费|公开|前端|后端/i,
  timing: /timing|\bwhen\b|\bbefore\b|\bafter\b|\border\b|时点|顺序|之前|之后|何时/i,
  permission: /permission|\bread|\bwrite|\bmutat|允许|权限|读|写|修改/i,
};
const required: Record<Category, (keyof typeof concepts)[]> = {
  behavior: ["responsibility", "input", "output", "boundary"],
  test: ["responsibility", "layer", "oracle"],
  data: ["responsibility", "owner", "structure", "boundary"],
  lifecycle: ["responsibility", "owner", "write", "invariant", "terminal"],
  adapter: ["responsibility", "sideEffect", "deadline", "cancellation", "boundary"],
  exports: ["consumer", "output", "boundary"],
  hook: ["responsibility", "timing", "input", "permission", "terminal"],
};
// 许可证、引用和工具指令不作为职责说明；保留原识别范围，不把后续好注释用来掩盖首个占位头。
const nonSubstantive = (text: string) => {
  const content = text
    .replace(/^\s*\/\*[*!]?|\*\/\s*$/g, "")
    .split("\n")
    .map((line) => line.replace(/^\s*(?:\*|\/\/\/?)\s?/, ""))
    .join("\n")
    .trim();
  return /^(?:<reference|@(?:ts-|jsx|license)|copyright\b|SPDX\b|licensed\b|license\b|eslint\b|prettier\b|noinspection\b|vite\b|istanbul\b|c8\b)/i.test(
    content,
  );
};

export function checkComments(
  ts: typeof TypeScript,
  input: ArchitectureInput,
): ArchitectureViolation[] {
  const failures: ArchitectureViolation[] = [],
    publicFiles = new Set([...input.files.map((file) => file.path), ...input.documentationPaths]);
  for (const file of input.files.filter((entry) => isTypedSource(entry.path))) {
    const source = parseSource(ts, file),
      first = source.statements[0],
      boundary = first?.getStart(source) ?? file.text.length;
    const scanner = ts.createScanner(
      ts.ScriptTarget.Latest,
      false,
      ts.LanguageVariant.Standard,
      file.text,
    );
    let header: { start: number; end: number; text: string } | undefined;
    for (
      let token = scanner.scan();
      token !== ts.SyntaxKind.EndOfFileToken && scanner.getTokenPos() < boundary;
      token = scanner.scan()
    ) {
      if (
        token !== ts.SyntaxKind.SingleLineCommentTrivia &&
        token !== ts.SyntaxKind.MultiLineCommentTrivia
      )
        continue;
      const text = scanner.getTokenText();
      if (nonSubstantive(text)) continue;
      const start = scanner.getTokenPos();
      if (token === ts.SyntaxKind.SingleLineCommentTrivia) {
        const remainder = file.text.slice(start, boundary),
          lines = remainder.split("\n"),
          collected: string[] = [];
        for (const line of lines) {
          if (!/^\s*\/\//.test(line)) break;
          collected.push(line);
        }
        header = { start, end: start + collected.join("\n").length, text: collected.join("\n") };
      } else header = { start, end: scanner.getTextPos(), text };
      break;
    }
    // scanner 只寻找首语句前的首份有效说明；后面的内容不能替代这一已选职责头。
    const category = commentCategory(file.path),
      pos = source.getLineAndCharacterOfPosition(header?.start ?? boundary);
    const add = (rule: string, detail: string, identity: string = category) =>
      failures.push(violation(rule, file.path, pos.line + 1, pos.character + 1, detail, identity));
    if (!header) {
      add(
        "comment.missing-head",
        `Missing ${category} responsibility contract before first business statement.`,
      );
      continue;
    }
    const text = header.text
      .replace(/^\s*\/\*\*?|\*\/\s*$/g, "")
      .split("\n")
      .map((line) => line.replace(/^\s*(?:\*|\/\/)\s?/, ""))
      .join("\n")
      .trim();
    if (
      !text ||
      /本文件相关逻辑|角色相关代码|负责.*相关(?:逻辑|代码)|this file handles (?:things|logic)|\bTODO\b|\bTBD\b/i.test(
        text,
      )
    ) {
      add("comment.placeholder", "Responsibility head is empty or uses placeholder language.");
      continue;
    }
    const firstParagraph = text.split(/\n\s*\n/)[0] ?? "";
    if (!concepts.responsibility.test(firstParagraph) && category !== "exports")
      add("comment.first-paragraph", "First substantive paragraph does not name a responsibility.");
    for (const field of required[category])
      if (!concepts[field].test(text))
        add(
          `comment.${field}`,
          `${category} head lacks its ${field} contract.`,
          `${category}:${field}`,
        );
    const links = [
      ...[...text.matchAll(/\[[^\]]+\]\(([^)]+)\)/g)].map((match) => ({
        target: match[1]!,
        rootRelative: match[1]!.startsWith("docs/"),
      })),
      ...[
        ...text.matchAll(
          /(?:^|[\s`(])((?:docs\/|\.{1,2}\/|\/(?:docs|backend|frontend|packages)\/)[a-zA-Z0-9_./-]+\.md(?:#[a-zA-Z0-9_-]+)?)/gm,
        ),
      ].map((match) => ({ target: match[1]!, rootRelative: match[1]!.startsWith("docs/") })),
    ];
    // 链接只核调用方给定的公共文件／文档路径集合；去掉 fragment，不在此验证实际锚点或文档语义。
    for (const link of [...new Map(links.map((link) => [link.target, link])).values()]) {
      const target = link.target.replace(/^<|>$/g, "").split("#")[0]!;
      if (!target || /^(?:https?:|mailto:)/.test(target)) continue;
      const resolved = link.rootRelative
        ? target
        : target.startsWith("/")
          ? target.slice(1)
          : path.posix.normalize(path.posix.join(path.posix.dirname(file.path), target));
      if (!publicFiles.has(resolved))
        add(
          "comment.broken-link",
          "Responsibility contract link does not point to a known public file.",
          `${category}:${target}`,
        );
    }
  }
  return failures;
}
