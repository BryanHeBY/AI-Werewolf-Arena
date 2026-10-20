/**
 * 这组架构测试负责用五种原始入口顺序核对初身份 setup 的冷初始化。入口标签和顺序保持，实际模块路径随职责目录迁移。
 * 每项独立解释器仍检查同三个公开构造器、退出码和成功字面；不启动对局，也不以导入成功替代玩法验收。
 */
import { expect, test } from "bun:test";
import path from "node:path";
// 键保留原测试身份，值只描述当前职责入口；不把历史标签当作可加载物理目录。
const entryTargets: Record<string, string> = {
  "initial_identity/setup": "./src/features/initial-identity/setup.ts",
  "shapeshifter/setup": "./src/features/shapeshifter/setup.ts",
  "thief/setup": "./src/features/thief/setup.ts",
  catalog: "./src/rulesets/roles/catalog.ts",
  "../../engine/phase_manager": "./src/engine/phase-manager.ts",
};
for (const entry of [
  "initial_identity/setup",
  "shapeshifter/setup",
  "thief/setup",
  "catalog",
  "../../engine/phase_manager",
]) {
  test(`fresh process imports identity setup from ${entry} without a temporal dead zone`, () => {
    const first = entryTargets[entry]!;
    const script = `
      await import(${JSON.stringify(first)});
      const shared = await import("./src/features/initial-identity/setup.ts");
      const thief = await import("./src/features/thief/setup.ts");
      const shape = await import("./src/features/shapeshifter/setup.ts");
      if (typeof shared.InitialIdentitySetupWindow !== "function" ||
          typeof thief.ThiefSetupWindow !== "function" ||
          typeof shape.ShapeshifterSetupWindow !== "function") throw new Error("missing_setup_constructor");
      console.log("identity_import_ok");
    `;
    const result = Bun.spawnSync([process.execPath, "-e", script], {
      cwd: path.resolve(import.meta.dir, "../.."),
      stdout: "pipe",
      stderr: "pipe",
    });
    if (result.exitCode !== 0) throw new Error(new TextDecoder().decode(result.stderr));
    expect(result.exitCode).toBe(0);
    expect(new TextDecoder().decode(result.stdout).trim()).toBe("identity_import_ok");
  }, 15000);
}
