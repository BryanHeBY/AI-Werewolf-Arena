/**
 * 负责本地原始配置文档的读取、版本冲突和串行保存；输入受限文件标识与 JSON，输出原文及内容摘要。
 * 本模块拥有文件写入，不解析环境变量或创建 Agent；临时文件原子替换，外部编辑冲突明确拒绝。
 * 路径逐级拒绝符号链接，认证遮罩仅在编辑边界使用，未改遮罩从同版本原文恢复。
 */
import { promises as fs, constants } from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import type { ConfigKind, ConfigDocument, JsonObject } from "@ai-werewolf-arena/workbench-contract";

const id = /^[a-z][a-z0-9_-]*$/;
const MASK = "__AWA_UNCHANGED_SECRET__";
export class WorkbenchError extends Error {
  constructor(
    readonly code: string,
    readonly status = 400,
    readonly fieldPath?: string,
  ) {
    super(code);
  }
}
export const revision = (text: string) => createHash("sha256").update(text).digest("hex");
export function objectDocument(text: string): JsonObject {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new WorkbenchError("invalid_json");
  }
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new WorkbenchError("object_required");
  return value as JsonObject;
}
export async function containedFile(root: string, relative: string): Promise<string> {
  const absolute = path.resolve(root);
  const target = path.resolve(absolute, relative);
  if (target === absolute || !target.startsWith(`${absolute}${path.sep}`))
    throw new WorkbenchError("invalid_path");
  // 校验根的每个祖先，避免配置根本身或中途目录通过链接逃出显式工作区。
  let current = path.parse(target).root;
  for (const piece of target.slice(current.length).split(path.sep)) {
    current = path.join(current, piece);
    try {
      if ((await fs.lstat(current)).isSymbolicLink())
        throw new WorkbenchError("symlink_not_allowed");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  return target;
}
function secretKey(key: string): boolean {
  return /api[_-]?key|authorization|token|password|secret|credential|private[_-]?key|^auth$|^access$|^refresh$|^key$/i.test(
    key,
  );
}
function maskSecrets(value: unknown, key = ""): unknown {
  if (typeof value === "string" && secretKey(key) && !/^\$\{[A-Z][A-Z0-9_]*\}$/.test(value))
    return value ? MASK : value;
  if (Array.isArray(value)) return value.map((entry) => maskSecrets(entry));
  if (value && typeof value === "object")
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, maskSecrets(v, k)]));
  return value;
}
function restoreSecrets(value: unknown, old: unknown): unknown {
  if (value === MASK) {
    if (typeof old !== "string") throw new WorkbenchError("secret_reentry_required");
    return old;
  }
  if (Array.isArray(value))
    return value.map((v, i) => restoreSecrets(v, Array.isArray(old) ? old[i] : undefined));
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [
        k,
        restoreSecrets(
          v,
          old && typeof old === "object" ? (old as Record<string, unknown>)[k] : undefined,
        ),
      ]),
    );
  return value;
}
export class ConfigDocuments {
  private writes = new Map<string, Promise<unknown>>();
  constructor(readonly root: string) {}
  private relative(kind: ConfigKind, name: string): string {
    if (!id.test(name) || !["backends", "agents", "games", "boards"].includes(kind))
      throw new WorkbenchError("invalid_config_name");
    if (kind === "backends" || kind === "agents") {
      if (name !== kind) throw new WorkbenchError("invalid_config_name");
      return `runtime/${kind}.json`;
    }
    return `${kind}/${name}.json`;
  }
  async list(kind: ConfigKind): Promise<string[]> {
    this.relative(kind, kind);
    if (kind === "backends" || kind === "agents") return [kind];
    const directory = await containedFile(this.root, `${kind}/.index`);
    try {
      return (await fs.readdir(path.dirname(directory), { withFileTypes: true }))
        .filter((e) => e.isFile() && e.name.endsWith(".json") && id.test(e.name.slice(0, -5)))
        .map((e) => e.name.slice(0, -5))
        .sort();
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
      throw error;
    }
  }
  async read(kind: ConfigKind, name: string, reveal = false): Promise<ConfigDocument> {
    const file = await containedFile(this.root, this.relative(kind, name));
    try {
      const raw = await fs.readFile(file, "utf8");
      return {
        kind,
        name,
        revision: revision(raw),
        text:
          kind === "backends" && !reveal
            ? JSON.stringify(maskSecrets(objectDocument(raw)), null, 2)
            : raw,
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT")
        throw new WorkbenchError("config_not_found", 404);
      throw error;
    }
  }
  async raw(kind: ConfigKind, name: string): Promise<JsonObject> {
    return objectDocument((await this.read(kind, name, true)).text);
  }
  async save(
    input: ConfigDocument,
    validate: (raw: JsonObject) => void | Promise<void> = () => {},
  ): Promise<ConfigDocument> {
    const key = this.relative(input.kind, input.name),
      previous = this.writes.get(key) ?? Promise.resolve();
    const operation = previous
      .catch(() => {})
      .then(async () => {
        const file = await containedFile(this.root, key);
        let original: string | null = null;
        try {
          original = await fs.readFile(file, "utf8");
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        }
        if ((original === null ? null : revision(original)) !== input.revision)
          throw new WorkbenchError("config_conflict", 409);
        let old: JsonObject | undefined;
        if (original !== null)
          try {
            old = objectDocument(original);
          } catch {
            // 源码编辑允许修复坏 JSON；旧文档无法解析时不能沿用遮罩，需重新填写认证。
          }
        const raw = restoreSecrets(objectDocument(input.text), old) as JsonObject;
        await validate(raw);
        const content = JSON.stringify(raw, null, 2) + "\n";
        await fs.mkdir(path.dirname(file), { recursive: true });
        const temporary = `${file}.${crypto.randomUUID()}.tmp`;
        try {
          await fs.writeFile(temporary, content, { mode: 0o600, flag: "wx" });
          // 校验期间仍可能有外部编辑；在替换前再次比对，服务内调用由上方队列串行化。
          let current: string | null = null;
          try {
            current = await fs.readFile(file, "utf8");
          } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
          }
          if (current !== original) throw new WorkbenchError("config_conflict", 409);
          await fs.rename(temporary, file);
        } finally {
          await fs.rm(temporary, { force: true });
        }
        return this.read(input.kind, input.name);
      });
    this.writes.set(key, operation);
    try {
      return await operation;
    } finally {
      if (this.writes.get(key) === operation) this.writes.delete(key);
    }
  }
  async initialize(examples: string): Promise<void> {
    for (const section of ["boards", "games", "runtime"]) {
      const source = path.join(examples, section);
      for (const entry of await fs.readdir(source, { withFileTypes: true })) {
        if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
        const destination = await containedFile(this.root, `${section}/${entry.name}`);
        await fs.mkdir(path.dirname(destination), { recursive: true });
        try {
          await fs.copyFile(path.join(source, entry.name), destination, constants.COPYFILE_EXCL);
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
        }
      }
    }
  }
}
