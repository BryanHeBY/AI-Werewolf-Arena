/** 负责成组制作产物发布。输入为候选生成与校验函数，输出原子发布的版本目录；失败不暴露半成品，不覆盖既有版本。 */
import { mkdir, mkdtemp, rename, rm, lstat, writeFile, readFile, readdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";

export async function publishVideoDirectory<T>(
  root: string,
  build: (candidate: string) => Promise<{ name: string; value: T }>,
): Promise<T> {
  await mkdir(root, { recursive: true });
  const candidate = await mkdtemp(path.join(root, ".candidate-"));
  try {
    const { name, value } = await build(candidate);
    if (!/^[a-zA-Z0-9_-]+$/.test(name)) throw new Error("video_version_invalid");
    const destination = path.join(root, name);
    try {
      await lstat(destination);
      const publication = JSON.parse(
        await readFile(path.join(destination, "publication.json"), "utf8"),
      );
      if (publication.complete !== true || publication.name !== name)
        throw new Error("video_version_incomplete");
      for (const file of await readdir(candidate)) {
        const digest = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
        const [previous, current] = await Promise.all([
          readFile(path.join(destination, file)),
          readFile(path.join(candidate, file)),
        ]);
        if (digest(previous) !== digest(current)) throw new Error("video_version_conflict");
      }
      return value;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      // 只有版本目录本身不存在才允许发布；现存版本缺文件属于损坏，不得替换。
      try {
        await lstat(destination);
        throw new Error("video_version_incomplete");
      } catch (missing) {
        if ((missing as NodeJS.ErrnoException).code !== "ENOENT") throw missing;
      }
    }
    await writeFile(
      path.join(candidate, "publication.json"),
      JSON.stringify({ version: 1, complete: true, name }) + "\n",
    );
    await rename(candidate, destination);
    return value;
  } finally {
    await rm(candidate, { recursive: true, force: true });
  }
}
