/**
 * 负责审计发现的合并、录制序号引用过滤和生成摘要的窄 Markdown 验收。
 * 输入为既有审计输出、录制证据与调用方允许集合；输出为保留的原发现、丢弃说明或格式布尔结果。
 * 审计流水线拥有任务和最终摘要，录制所有者拥有原事件；本模块不读取文件、调用模型或改写对局结果。
 * 序号存在与格式合规不证明发现真实，也不授予玩家可见权限；摘要调用方须先收窄本次允许集合。
 */
import { auditHeadings, text, type Locale } from "@ai-werewolf-arena/game-text";
import { AuditAgentFinding, AuditAgentOutput } from "./payload-builder";
import type { DebugSummaryPipelineInput } from "./pipeline";

const SEVERITY_RANK: Record<AuditAgentFinding["severity"], number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
};

/** 合并结果保留发现原引用；失败名称／缺失说明不去重，总数按输入输出条目计，不按 Agent 名称计。 */
export interface MergedAuditFindings {
  findings: AuditAgentFinding[];
  failedAgents: string[];
  missingInfo: string[];
  totalAgents: number;
}

/** 每次方法调用独立计算；排序、引用过滤与摘要格式验收分开，不维护跨会话缓存。 */
export class AuditEvidencePolicy {
  /** 按类别、消息和有序证据串首条保留；失败输出仍可贡献发现，重复项不会升级首条严重度。 */
  merge(outputs: AuditAgentOutput[]): MergedAuditFindings {
    const unique = new Map<string, AuditAgentFinding>();
    const failedAgents: string[] = [];
    const missingInfo: string[] = [];
    for (const output of outputs) {
      if (output.failed) {
        failedAgents.push(output.agent);
        if (output.failure_reason) missingInfo.push(`${output.agent}: ${output.failure_reason}`);
      }
      for (const finding of output.findings) {
        const key = `${finding.category}|${finding.message}|${finding.evidence.join(",")}`;
        if (!unique.has(key)) unique.set(key, finding);
      }
      for (const note of output.missing_info) missingInfo.push(`${output.agent}: ${note}`);
    }
    // 先严重度降序，再按首证据序号升序；缺首证据按 0 比较，平级沿原稳定排序。
    const findings = [...unique.values()].sort(
      (a, b) =>
        SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity] ||
        (a.evidence[0] ?? 0) - (b.evidence[0] ?? 0),
    );
    return { findings, failedAgents, missingInfo, totalAgents: outputs.length };
  }

  /** 合并公共事件、逻辑操作和玩家时间线的原序号；这里只核集合来源，不再次过滤受众或校验整数。 */
  allowedSequences(input: DebugSummaryPipelineInput): Set<number> {
    const sequences = new Set<number>();
    for (const event of input.publicEvents) sequences.add(event.seq);
    for (const operation of input.logicOps) sequences.add(operation.seq);
    for (const view of input.playerViews) {
      for (const entry of view.timeline) sequences.add(entry.seq);
    }
    return sequences;
  }

  /** 空证据或任一序号不在允许集合即整条丢弃；通过者保留同一对象，不修补部分无效引用。 */
  filterByEvidence(findings: AuditAgentFinding[], allowed: Set<number>) {
    const kept: AuditAgentFinding[] = [];
    const dropped: string[] = [];
    for (const finding of findings) {
      if (!finding.evidence?.length) {
        dropped.push(`[no_evidence] ${finding.message}`);
        continue;
      }
      const invalid = finding.evidence.filter((sequence) => !allowed.has(sequence));
      if (invalid.length) {
        dropped.push(`[invalid_evidence] ${finding.message} evidence=${invalid.join(",")}`);
      } else {
        kept.push(finding);
      }
    }
    return { findings: kept, dropped };
  }

  /** 按语言要求精确章节顺序与发现条目；只接受此摘要协议，不提供通用 Markdown 渲染或内容真实性证明。 */
  validatesMarkdown(markdown: string, allowed: Set<number>, locale: Locale = "en"): boolean {
    const lines = markdown.split("\n").map((line) => line.replace(/\r$/, ""));
    // 先拒绝代码块、HTML、引用和缩进代码等结构，再识别标题；列表容器内也不能藏标题或引用。
    for (const line of lines) {
      if (
        /^\s*(?:```|~~~)/.test(line) ||
        /<\/?[a-z][^>]*>|<!--|-->|<!|<\?/i.test(line) ||
        /^(?: {4}|[ \t]*\t)/.test(line) ||
        /^[ \t]*>/.test(line) ||
        /^[ \t]*(?:=+|-+)[ \t]*$/.test(line)
      )
        return false;
      let content = line.trimStart();
      let container = false;
      for (;;) {
        const prefix = /^(?:[-+*]|\d+[.)])[ \t]+/.exec(content);
        if (!prefix) break;
        container = true;
        content = content.slice(prefix[0].length).trimStart();
      }
      if (container && (/^#{1,6}(?:[ \t]|$)/.test(content) || content.startsWith(">")))
        return false;
    }
    const headings = auditHeadings(locale);
    const sections: Array<{ name: string; index: number }> = [];
    let titleSeen = false;
    const firstContent = lines.findIndex((line) => line.trim());
    for (let index = 0; index < lines.length; index++) {
      const line = lines[index];
      if (!/^[ \t]{0,3}#{1,6}(?:[ \t]|$)/.test(line)) continue;
      if (/^# [^#].*[^#]$/.test(line) && index === firstContent && !titleSeen) {
        titleSeen = true;
        continue;
      }
      const match = /^## ([^#]+)$/.exec(line);
      if (!match || !Object.values(headings).includes(match[1])) return false;
      sections.push({ name: match[1], index });
    }
    const names = sections.map((section) => section.name);
    const hasObservations = names.includes(headings.observations);
    const ending = names.includes(headings.todo) ? headings.todo : headings.conclusion;
    const expected = [
      headings.session,
      headings.stats,
      headings.findings,
      ...(hasObservations ? [headings.observations] : []),
      ending,
      headings.pipeline,
    ];
    if (JSON.stringify(names) !== JSON.stringify(expected)) return false;
    // 每行至多一个 evidence=，逗号串必须为允许集合中的正安全整数；其后仍可带原摘要说明。
    const evidenceValid = (line: string, required: boolean): boolean => {
      const markers = [...line.matchAll(/evidence=/gi)];
      if (!markers.length) return !required;
      if (markers.length !== 1) return false;
      const tail = line
        .slice(markers[0].index! + markers[0][0].length)
        .replace(/[ \t]*,[ \t]*/g, ",");
      const match = /^([1-9]\d*(?:,[1-9]\d*)*)(?:[ \t]+|$)/.exec(tail);
      if (!match) return false;
      return match[1]
        .split(",")
        .every((value) => Number.isSafeInteger(Number(value)) && allowed.has(Number(value)));
    };
    // 发现章节外出现的证据标记也使用调用方同一允许集合；未标引用的普通行无需强制补证据。
    if (lines.some((line) => !evidenceValid(line, false))) return false;
    const start = sections.find((section) => section.name === headings.findings)!.index;
    const end = sections.find((section) => section.index > start)!.index;
    const entries = lines.slice(start + 1, end).filter((line) => line.trim());
    if (!entries.length) return false;
    const none = `- ${text(locale, "common.none")}`.toLowerCase();
    // 发现章节只能是单条本语言“无”，或每条都有证据的顶层列表；两者不能混用。
    if (entries.length === 1 && entries[0].toLowerCase() === none) return true;
    return entries.every(
      (line) =>
        !/^[ \t]{4}/.test(line) &&
        line.startsWith("- ") &&
        line.trim().toLowerCase() !== none &&
        evidenceValid(line, true),
    );
  }
}
