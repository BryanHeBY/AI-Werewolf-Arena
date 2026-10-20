/**
 * 负责识别原生复现构建所用的自维护引擎、运行时、Agent、录制及共享包源码字节。
 * 输入为显式仓库根目录；输出为有序公开路径及源码／锁文件 SHA-256。文件系统适配
 * 不拥有 World、规则或历史兼容政策。路径、注释、词典、未执行 schema、包配置和根／
 * 应用／共享包的 tsconfig 清单均参与精确身份；浏览器应用入口与测试不在本源码范围。
 * 本地配置／认证、依赖目录和生成记录不参与枚举，依赖版本由独立锁文件指纹表示。
 */
import { createHash } from "node:crypto";
import { readdir, readFile, lstat } from "node:fs/promises";
import path from "node:path";

export const ENGINE_FINGERPRINT_POLICY = "awa-all-runtime-and-shared-source-v2" as const;
const privateDirectories = new Set(["node_modules", ".git", ".codex", ".agents", ".aws"]);

/** 按确定顺序枚举实际源码成员；在已解析根目录下逐段检查路径与遍历子项，拒绝源码路径链接。 */
export async function engineFingerprintInputs(repositoryRoot: string): Promise<string[]> {
  const root = path.resolve(repositoryRoot),
    files: string[] = [];
  // 从已解析根目录开始检查相对路径各段；不读取源码路径中软链接指向的内容。
  const rejectSymlinkAncestors = async (relative: string) => {
    let current = root;
    for (const segment of relative.split("/")) {
      current = path.join(current, segment);
      if ((await lstat(current)).isSymbolicLink()) throw Error("engine_source_symlink_rejected");
    }
  };
  for (const manifest of [
    "package.json",
    "apps/game/package.json",
    "apps/replay/package.json",
    "apps/video/package.json",
    "apps/workbench/package.json",
    "bunfig.toml",
  ]) {
    try {
      await rejectSymlinkAncestors(manifest);
      files.push(manifest);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  // 只读取各所有者目录当层的 tsconfig 清单；缺文件允许跳过，其它 I/O 或链接错误原样传播。
  const compilerManifests = async (owner: string) => {
    try {
      if (owner) await rejectSymlinkAncestors(owner);
      for (const entry of await readdir(path.join(root, owner), { withFileTypes: true })) {
        if (!/^tsconfig(?:\.[^.]+)*\.json$/.test(entry.name)) continue;
        const name = path.posix.join(owner, entry.name);
        await rejectSymlinkAncestors(name);
        if (entry.isFile()) files.push(name);
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  };
  for (const owner of ["", "apps/game", "apps/replay", "apps/video", "apps/workbench"])
    await compilerManifests(owner);
  // 递归只接受源码扩展名；私有目录、环境文件和认证文件在加入路径集合前排除。
  const walk = async (relative: string): Promise<void> => {
    await rejectSymlinkAncestors(relative);
    for (const entry of (await readdir(path.join(root, relative), { withFileTypes: true })).sort(
      (a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0),
    )) {
      if (
        privateDirectories.has(entry.name) ||
        entry.name.startsWith(".env") ||
        ["auth.json", "credentials.json"].includes(entry.name)
      )
        continue;
      const name = path.posix.join(relative, entry.name);
      if (entry.isSymbolicLink()) throw Error("engine_source_symlink_rejected");
      if (entry.isDirectory()) await walk(name);
      else if (entry.isFile() && /\.(?:[cm]?[jt]sx?|json)$/.test(entry.name)) files.push(name);
    }
  };
  // 独立游戏 CLI 迁出运行包后仍属于旧引擎的执行来源；浏览器应用不在此枚举。
  // 合成源码根允许没有应用入口，但真实仓库会把现有 CLI 字节完整纳入。
  try {
    await readdir(path.join(root, "apps/game/src"));
    await walk("apps/game/src");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  // 运行包与所有共享包的源码、未执行 schema 和元数据均参与身份，不借迁移缩小来源范围。
  await rejectSymlinkAncestors("packages/game-runtime/src");
  await rejectSymlinkAncestors("packages");
  for (const entry of (await readdir(path.join(root, "packages"), { withFileTypes: true })).sort(
    (a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0),
  )) {
    if (privateDirectories.has(entry.name) || entry.name.startsWith(".env")) continue;
    if (entry.isSymbolicLink()) throw Error("engine_source_symlink_rejected");
    if (!entry.isDirectory()) continue;
    const manifest = `packages/${entry.name}/package.json`;
    try {
      await rejectSymlinkAncestors(manifest);
      files.push(manifest);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    await compilerManifests(`packages/${entry.name}`);
    const source = `packages/${entry.name}/src`;
    try {
      await readdir(path.join(root, source));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") continue;
      throw error;
    }
    await walk(source);
  }
  // 最终去重并用固定字符比较排序，避免目录枚举顺序改变同一构建的指纹。
  return [...new Set(files)].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}

/** 先拒绝锁文件链接，再按路径／原始字节的零字符分隔串计算源码身份；锁身份单独计算。 */
export async function fingerprintEngine(
  repositoryRoot: string,
): Promise<{ sourceHash: string; lockHash: string }> {
  const root = path.resolve(repositoryRoot),
    hash = createHash("sha256");
  if ((await lstat(path.join(root, "bun.lock"))).isSymbolicLink())
    throw Error("engine_source_symlink_rejected");
  // 不规范化换行或注释；纯目录迁移、中文注释和词典改动也产生新 sourceHash。
  for (const name of await engineFingerprintInputs(root))
    hash
      .update(name)
      .update("\0")
      .update(await readFile(path.join(root, name)))
      .update("\0");
  return {
    sourceHash: hash.digest("hex"),
    lockHash: createHash("sha256")
      .update(await readFile(path.join(root, "bun.lock")))
      .digest("hex"),
  };
}
