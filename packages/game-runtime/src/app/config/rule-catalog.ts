/**
 * 负责将实际板子与角色配置 schema 投影为只读表单目录；输入运行登记，输出字段和缺省值，供工作台选择已有规则。
 * JSON Schema 只描述字段和默认值；组合支持及保存校验仍归原解析器，不另建一套规则判断。
 */
import { z } from "zod";
import { boardDefinitionSchema } from "./board-definition";
import { getDefaultRoleContributions } from "../../rulesets/roles/role-catalog-assembly";

export function describeBoardRuleCatalog() {
  return {
    board: z.toJSONSchema(boardDefinitionSchema),
    roles: getDefaultRoleContributions().flatMap((entry) => {
      const configuration = entry.runtime?.configuration;
      return configuration
        ? [
            {
              role: entry.metadata.role,
              schema: z.toJSONSchema(configuration.schema),
              defaults: structuredClone(configuration.defaults),
            },
          ]
        : [];
    }),
  };
}
