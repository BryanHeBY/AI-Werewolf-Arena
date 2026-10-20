/** 单元测试负责验证制作工具的文件边界与清单重定位。输入为独立临时素材，输出Range、只读检查和声线身份不变的断言；不调用云端。 */
import { expect, test } from "bun:test";
import { mkdtemp, writeFile, rm, mkdir } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { createHash } from "node:crypto";
import { serveLocalReview } from "../../../scripts/video/review-http";
import { readSpeechManifest } from "../../../scripts/video/speech-script";
import { prepareVideoAudio } from "../../../scripts/prepare-video-audio";

test("review serving supports seeking and HEAD while refusing unlisted files and invalid ranges", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "awa-review-"));
  await writeFile(path.join(directory, "movie.mp4"), "0123456789");
  const server = serveLocalReview({
    root: directory,
    port: 0,
    async resolve(name) {
      return name === "/movie.mp4" ? path.join(directory, "movie.mp4") : undefined;
    },
  });
  try {
    for (const [range, expected] of [
      ["bytes=2-5", "2345"],
      ["bytes=-3", "789"],
      ["bytes=8-", "89"],
      ["bytes=8-100", "89"],
    ]) {
      const response = await fetch(new URL("movie.mp4", server.url), {
        headers: { Range: range! },
      });
      expect(response.status).toBe(206);
      expect(await response.text()).toBe(expected);
    }
    for (const range of ["bytes=-", "bytes=12-", "bytes=5-2", "bytes=0-1,4-5"])
      expect(
        (await fetch(new URL("movie.mp4", server.url), { headers: { Range: range } })).status,
      ).toBe(416);
    const head = await fetch(new URL("movie.mp4", server.url), { method: "HEAD" });
    expect(head.headers.get("content-length")).toBe("10");
    expect(await head.text()).toBe("");
    expect((await fetch(new URL(".env.tts.local", server.url))).status).toBe(404);
    expect((await fetch(new URL("movie.mp4", server.url), { method: "POST" })).status).toBe(405);
  } finally {
    server.stop(true);
    await rm(directory, { recursive: true, force: true });
  }
});

test("a prepared manifest resolves its audio against its own directory rather than the author project", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "awa-manifest-"));
  try {
    const file = path.join(directory, "manifest.ts");
    await writeFile(file, 'export default {line:{src:"../audio/voice.wav",key:"unchanged"}};');
    const manifest = await readSpeechManifest(file);
    expect(manifest.line!.src).toBe(
      new URL(`file://${path.dirname(directory)}/audio/voice.wav`).href,
    );
    expect(manifest.line!.key).toBe("unchanged");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("audio preparation can publish from verified local files without downloading and refuses corruption", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "awa-audio-sources-"));
  try {
    const library = path.join(directory, "library"),
      sources = path.join(directory, "sources.json");
    await mkdir(library);
    const bytes = Buffer.from("local fixture"),
      asset = {
        id: "fixture",
        file: "tone.wav",
        sha256: createHash("sha256").update(bytes).digest("hex"),
        downloadUrl: "https://example.invalid/must-not-request.wav",
        sourceUrl: "https://example.invalid/source",
        license: "fixture",
        licenseUrl: "https://example.invalid/license",
      };
    await writeFile(path.join(library, asset.file), bytes);
    await writeFile(sources, JSON.stringify({ assets: [asset] }));
    expect((await prepareVideoAudio({ sources, directory: library })).assets).toBe(1);
    await writeFile(path.join(library, asset.file), "corrupt");
    await expect(prepareVideoAudio({ sources, directory: library, check: true })).rejects.toThrow(
      "video_audio_digest_mismatch",
    );
    await writeFile(sources, JSON.stringify({ assets: [{ ...asset, file: "../outside.wav" }] }));
    await expect(prepareVideoAudio({ sources, directory: library, check: true })).rejects.toThrow(
      "video_audio_path_outside_library",
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
