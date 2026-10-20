/**
 * 负责将实际板子与角色配置 schema 投影为只读表单目录；输入运行登记，输出字段和缺省值，供工作台选择已有规则。
 * JSON Schema 只描述字段和默认值；组合支持及保存校验仍归原解析器，不另建一套规则判断。
 */
import { z } from "zod";
import {
  boardDefinitionSchema,
  boardDefinitionFromConfig,
  BoardConfigurationError,
  parseBoardDefinition,
} from "./board-definition";
import { getDefaultRoleContributions } from "../../rulesets/roles/role-catalog-assembly";
import {
  applyBoardRuleEdit,
  type Json,
  type JsonObject,
} from "@ai-werewolf-arena/workbench-contract";

export interface BoardRuleConstraint {
  /** 枚举、布尔及数组的一次编辑候选。只列真实解析器允许的值，不自行放宽有限板子。 */
  allowedValues?: Json[];
  omittable?: boolean;
  fixed?: boolean;
}
function object(value: unknown): JsonObject {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as JsonObject) : {};
}
function read(value: JsonObject, path: string): Json | undefined {
  return path.split(".").reduce<Json | undefined>((owner, key) => object(owner)[key], value);
}
function choices(schema: JsonObject): Json[] {
  if (Array.isArray(schema.enum)) return schema.enum;
  return Array.isArray(schema.anyOf)
    ? schema.anyOf.flatMap((entry) =>
        Object.hasOwn(object(entry), "const") ? [object(entry).const] : [],
      )
    : [];
}

export function describeBoardRuleCatalog(raw?: unknown) {
  const catalog = {
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
  const constraints: Record<string, BoardRuleConstraint> = {};
  const diagnostics: { code: string; path: string }[] = [];
  let resolved: JsonObject | undefined;
  if (raw !== undefined) {
    try {
      const parsed = parseBoardDefinition(raw);
      // 角色组合会贡献缺省（如动物板的熊天亮取样），表单展示真正运行值，而非孤立角色缺省。
      resolved = boardDefinitionFromConfig(
        parsed.definition.id,
        parsed.config,
      ) as unknown as JsonObject;
      // 旧原文可能还带着 PK 流程不会使用的平票值；只读投影应说明实际结论，不回写文件。
      resolved = applyBoardRuleEdit(
        resolved,
        "mechanisms.sheriff.electionPolicy",
        read(resolved, "mechanisms.sheriff.electionPolicy"),
      );
      if (parsed.definition.board.roleSetups.some((row) => row.role === "bear")) {
        // 普通熊的历史空配置使用夜帧缺省；动物板已在解析时贡献天亮取样。这里只补显示值，不改原文。
        (resolved.roles as JsonObject).bear = {
          signalPolicy: parsed.config.bear?.signalPolicy ?? "awa_night_open_v1",
        };
      }
      const draft = raw as JsonObject;
      const accepted = (path: string, value: Json | undefined) => {
        try {
          const next = applyBoardRuleEdit(draft, path, value);
          if (value !== undefined && JSON.stringify(read(next, path)) !== JSON.stringify(value))
            return false;
          parseBoardDefinition(next);
          return true;
        } catch {
          return false;
        }
      };
      const inspect = (schema: JsonObject, prefix: string) => {
        for (const [name, entry] of Object.entries(object(schema.properties))) {
          const definition = object(entry),
            path = `${prefix}.${name}`;
          if (path === "rules.hooks" || Object.hasOwn(definition, "const")) continue;
          if (definition.type === "object") {
            inspect(definition, path);
            continue;
          }
          const current = read(resolved!, path);
          const optional = !(Array.isArray(schema.required) && schema.required.includes(name));
          const values = choices(definition);
          const state: BoardRuleConstraint = { omittable: optional && accepted(path, undefined) };
          if (definition.type === "boolean") values.push(true, false);
          if (definition.type === "array") {
            const selected = Array.isArray(current) ? current : [];
            values.push(selected);
            for (const option of choices(object(definition.items)))
              values.push(
                selected.includes(option)
                  ? selected.filter((item) => item !== option)
                  : [...selected, option],
              );
            // 判胜序列调整也经同一解析器核验；固定序列不展示可操作的上移按钮。
            if (name === "winConditions")
              selected.forEach((_, index) => {
                if (!index) return;
                const ordered = [...selected];
                [ordered[index - 1], ordered[index]] = [ordered[index], ordered[index - 1]];
                values.push(ordered);
              });
          }
          if (values.length) {
            state.allowedValues = values.filter(
              (value, index) =>
                values.findIndex((other) => JSON.stringify(other) === JSON.stringify(value)) ===
                  index && accepted(path, value),
            );
            state.fixed = state.allowedValues.every(
              (value) => JSON.stringify(value) === JSON.stringify(current),
            );
          } else if (definition.type === "number" || definition.type === "integer") {
            // 当前唯一无界数值为票权；只有多个不同合法数值均被有限预设拒绝才呈现固定值。
            const probes =
              name === "initialSeat"
                ? Array.from({ length: parsed.definition.board.size }, (_, index) => index + 1)
                : [1, 1.5, 2, 3];
            state.fixed = !probes.some((value) => value !== current && accepted(path, value));
          }
          constraints[path] = state;
        }
      };
      const root = object(catalog.board.properties);
      inspect(object(root.rules), "rules");
      inspect(object(root.mechanisms), "mechanisms");
      for (const role of catalog.roles)
        if (parsed.definition.board.roleSetups.some((row) => row.role === role.role))
          inspect(role.schema as JsonObject, `roles.${role.role}`);
    } catch (error) {
      if (error instanceof BoardConfigurationError)
        diagnostics.push({ code: error.code, path: error.fieldPath });
      else throw error;
    }
  }
  return { ...catalog, constraints, resolved, diagnostics };
}
