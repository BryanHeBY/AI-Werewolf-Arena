/**
 * 单元测试负责原生角色共同格式化器的契约字段与失败顺序。输入为独立手写报告、政策 getter 和非法语言；
 * 字面文字、错误与读取 trace 是独立预期，不导入后端状态、World 或完整对局，不把报告当当前真实身份。
 */
import { expect, test } from "bun:test";
import type { Locale, RoleInspectionReadState } from "@ai-werewolf-arena/game-contract";
import {
  formatNativeInspectionLabel,
  formatNativeInspectionPolicy,
  formatNativeRoleMessage,
} from "../src";

test("combined reports format role before camp without pre-reading the later field", () => {
  const reads: string[] = [];
  const result = {
    get kind() {
      reads.push("kind");
      return "combined" as const;
    },
    get role() {
      reads.push("role");
      return "witch" as const;
    },
    get camp() {
      reads.push("camp");
      return "wolf" as const;
    },
  };
  expect(() => formatNativeInspectionLabel(result, "unknown" as Locale)).toThrow(
    "i18n_locale_invalid",
  );
  expect(reads).toEqual(["kind", "kind", "role"]);
  reads.length = 0;
  expect(formatNativeInspectionLabel(result, "en")).toBe("Witch (Werewolves)");
  expect(reads).toEqual(["kind", "kind", "role", "camp"]);
});

test("non-repeat policy keeps the second late configuration read before language validation", () => {
  const reads: string[] = [],
    failure = new Error("second_policy_read");
  const policy: Pick<RoleInspectionReadState, "policy" | "inspectionPolicy"> = {
    get inspectionPolicy() {
      reads.push("inspectionPolicy");
      if (reads.length === 2) throw failure;
      return "awa_unique_required_v1" as const;
    },
    get policy(): never {
      throw new Error("unused_role_policy");
    },
  };
  expect(() => formatNativeInspectionPolicy(policy, "unknown" as Locale)).toThrow(failure);
  expect(reads).toEqual(["inspectionPolicy", "inspectionPolicy"]);
});

test("explicit repeat policy short circuits the second query and all role-policy access", () => {
  const reads: string[] = [];
  const policy: Pick<RoleInspectionReadState, "policy" | "inspectionPolicy"> = {
    get inspectionPolicy() {
      reads.push("inspectionPolicy");
      return "awa_repeat_optional_v1" as const;
    },
    get policy(): never {
      throw new Error("unused_role_policy");
    },
  };
  expect(formatNativeInspectionPolicy(policy, "en")).toBe(
    "Configured AWA inspection: another living target; repeat inspection across nights is allowed. A clean tool-free pass closes this night without spending. Invalid replies are not a pass. Reports use the current rule role label.",
  );
  expect(reads).toEqual(["inspectionPolicy"]);
});

test("typed message convenience keeps original text and scalar validation", () => {
  expect(formatNativeRoleMessage("en", "role.wolf.state")).toBe(
    "Your role is Werewolf. You may join night tactics and the collective kill vote.",
  );
  expect(() => formatNativeRoleMessage("en", "role.witch.state", { heal: NaN, poison: 1 })).toThrow(
    "i18n_parameter_invalid: role.witch.state.heal",
  );
});
