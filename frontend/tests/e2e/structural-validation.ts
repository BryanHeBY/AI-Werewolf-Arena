/**
 * Vue模板结构验证工具
 * 用于避免模板标签不匹配的问题
 */

export function validateVueTemplate(template: string): boolean {
  const lines = template.split("\n");
  let inTemplate = false;
  let depth = 0;
  let templateStartLine = -1;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // 检测模板开始
    if (line.includes("<template>")) {
      inTemplate = true;
      templateStartLine = i;
      depth = 0;
    }

    // 检测模板结束
    if (line.includes("</template>") && inTemplate) {
      inTemplate = false;
      if (depth !== 0) {
        console.error(
          `⚠️ 模板结束标签在行 ${i + 1}，但嵌套深度为 ${depth} (应从行 ${templateStartLine + 1} 开始)`,
        );
        return false;
      }
    }

    // 在模板内时计算深度
    if (inTemplate) {
      if (
        line.includes("<div") &&
        !line.includes("</div>") &&
        !line.includes("/>")
      ) {
        depth++;
      }
      if (line.includes("</div>")) {
        depth--;
      }

      // 检查深度是否小于0（过早关闭）
      if (depth < 0) {
        console.error(`❌ 在第 ${i + 1} 行发现过早的闭合标签`);
        return false;
      }
    }
  }

  return true;
}

export function checkTemplateBalance(template: string): {
  balanced: boolean;
  issues: string[];
} {
  const issues: string[] = [];
  const lines = template.split("\n");
  let openTags: { tag: string; line: number }[] = [];
  let closeTags: { tag: string; line: number }[] = [];
  let inTemplate = false;
  let templateLine = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // 检测模板开始
    if (line.includes("<template>")) {
      inTemplate = true;
      templateLine = i + 1;
    }

    // 检测模板结束
    if (line.includes("</template>") && inTemplate) {
      inTemplate = false;
    }

    // 在模板内分析标签
    if (inTemplate) {
      // 匹配打开标签
      const openMatches = line.match(/<(\w+)[^>]*>/g);
      if (openMatches) {
        for (const match of openMatches) {
          if (!match.endsWith("/>")) {
            const tagName = match.substring(1, match.indexOf(" "));
            openTags.push({ tag: tagName, line: i + 1 });
          }
        }
      }

      // 匹配闭合标签
      const closeMatches = line.match(/<\/(\w+)>/g);
      if (closeMatches) {
        for (const match of closeMatches) {
          const tagName = match.substring(2, match.indexOf(">"));
          closeTags.push({ tag: tagName, line: i + 1 });
        }
      }
    }
  }

  // 检查标签匹配
  let openIndex = 0;
  let closeIndex = 0;

  while (openIndex < openTags.length && closeIndex < closeTags.length) {
    if (openTags[openIndex].tag === closeTags[closeIndex].tag) {
      openIndex++;
      closeIndex++;
    } else {
      issues.push(
        `第 ${openTags[openIndex].line} 行的 <${openTags[openIndex].tag}> 标签在第 ${closeTags[closeIndex].line} 行无法匹配`,
      );
      return { balanced: false, issues };
    }
  }

  // 检查未关闭的标签
  if (openTags.length > closeTags.length) {
    for (let i = openIndex; i < openTags.length; i++) {
      issues.push(
        `第 ${openTags[i].line} 行的 <${openTags[i].tag}> 标签没有关闭`,
      );
    }
  }

  // 检查多余的闭合标签
  if (closeTags.length > openTags.length) {
    for (let i = closeIndex; i < closeTags.length; i++) {
      issues.push(
        `第 ${closeTags[i].line} 行的 </${closeTags[i].tag}> 标签没有对应的打开标签`,
      );
    }
  }

  return {
    balanced: openTags.length === closeTags.length && issues.length === 0,
    issues,
  };
}
