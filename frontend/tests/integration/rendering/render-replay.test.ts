/**
 * Integration tests for rendering input guards and owned output/browser cleanup.
 * Inputs are the unchanged public replay fixture, real filesystem competitors
 * and injected rendering callbacks. Literal errors, call order and output bytes
 * independently verify rejection, publication and failure prefixes. Browser
 * ownership is tested with a fake rendering adapter; no real browser or model
 * is launched. Each test removes only its owned /tmp fixtures.
 */
import { frontendFixtureURL } from "../../support/fixtures/manifest";
import { expect, test } from "bun:test";
import { mkdtemp, copyFile, readFile, writeFile, symlink, link, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { renderReplay } from "../../../scripts/render-replay";

test("render entry rejects invalid inputs and output aliases before starting browser or bundling", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "awa-render-guard-"));
  try {
    const input = path.join(root, "replay.json");
    await copyFile(frontendFixtureURL("frontend/tests/fixtures/sample.replay.json"), input);
    const before = await readFile(input, "utf8");
    const output = path.join(root, "existing.png");
    await writeFile(output, "keep output");
    await symlink(input, path.join(root, "linked.png"));
    await link(input, path.join(root, "hard.png"));
    await symlink(path.join(root, "absent"), path.join(root, "dangling.png"));
    for (const target of [
      output,
      path.join(root, "linked.png"),
      path.join(root, "hard.png"),
      path.join(root, "dangling.png"),
    ])
      await expect(renderReplay(["--input", input, "--output", target])).rejects.toThrow(
        "replay_render_output_exists",
      );
    await expect(renderReplay(["--input", input, "--output", input])).rejects.toThrow(
      "replay_render_source_overwrite",
    );
    for (const [extra, code] of [
      [["--locale", "xx"], "replay_display_locale_invalid"],
      [["--time-zone", "xx"], "replay_display_time_zone_invalid"],
      [["--frame=-1"], "replay_frame_invalid"],
      [["--frame", "1.5"], "replay_frame_invalid"],
      [["--frame", "180"], "replay_frame_out_of_range"],
    ] as const)
      await expect(
        renderReplay(["--input", input, "--output", path.join(root, "new.png"), ...extra]),
      ).rejects.toThrow(code);
    await expect(
      renderReplay(["--input", input, "--output", path.join(root, "new.json")]),
    ).rejects.toThrow("replay_render_output_extension_invalid");
    expect(await readFile(input, "utf8")).toBe(before);
    expect(await readFile(output, "utf8")).toBe("keep output");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

type Rendering = NonNullable<Parameters<typeof renderReplay>[1]>;
async function renderFixture(job: {
  openError?: Error;
  selectError?: Error;
  renderError?: Error;
  closeError?: Error;
  onRender?: (source: string, target: string) => Promise<void>;
}) {
  const root = await mkdtemp(path.join(os.tmpdir(), "awa-render-owner-"));
  const source = path.join(root, "source.json");
  const target = path.join(root, "target.png");
  await copyFile(frontendFixtureURL("frontend/tests/fixtures/sample.replay.json"), source);
  const original = await readFile(source, "utf8");
  const calls: string[] = [];
  let temporary = "";
  const browser = {
    close: async () => {
      calls.push("close-start");
      await Promise.resolve();
      calls.push("close-complete");
      if (job.closeError) throw job.closeError;
    },
  } as unknown as Awaited<ReturnType<Rendering["openBrowser"]>>;
  const rendering: Rendering = {
    bundle: async (...args) => {
      const options = args[0];
      if (typeof options === "string") throw new Error("unexpected legacy bundle signature");
      temporary = path.dirname(options.outDir!);
      calls.push("bundle");
      return "fixture-bundle";
    },
    openBrowser: async () => {
      calls.push("open");
      if (job.openError) throw job.openError;
      return browser;
    },
    selectComposition: async (options) => {
      calls.push("select");
      expect(options.puppeteerInstance).toBe(browser);
      if (job.selectError) throw job.selectError;
      return {
        id: "Replay",
        durationInFrames: 180,
        width: 1280,
        height: 720,
        fps: 30,
        defaultProps: {},
        props: {},
        defaultCodec: null,
        defaultOutName: null,
        defaultVideoImageFormat: null,
        defaultPixelFormat: null,
        defaultProResProfile: null,
        defaultSampleRate: null,
      };
    },
    renderStill: async (options) => {
      calls.push("render");
      expect(options.puppeteerInstance).toBe(browser);
      expect(options.output).not.toBe(target);
      await job.onRender?.(source, target);
      if (job.renderError) throw job.renderError;
      await writeFile(options.output!, "complete artifact");
      return { buffer: null, contentType: "image/png" };
    },
    renderMedia: async () => {
      throw new Error("unexpected media path");
    },
  };
  let error: unknown;
  try {
    await renderReplay(["--input", source, "--output", target, "--frame", "100"], rendering);
  } catch (caught) {
    error = caught;
  }
  return { root, source, target, original, calls, temporary, error };
}

test("renderer awaits owned browser close after successful render and failures, preserving all errors", async () => {
  const selectError = new Error("selection failed"),
    renderError = new Error("render failed"),
    closeError = new Error("close failed"),
    openError = new Error("open failed");
  for (const [job, expectedCalls, expectedError] of [
    [{}, ["bundle", "open", "select", "render", "close-start", "close-complete"], undefined],
    [{ openError }, ["bundle", "open"], openError],
    [{ selectError }, ["bundle", "open", "select", "close-start", "close-complete"], selectError],
    [
      { renderError, closeError },
      ["bundle", "open", "select", "render", "close-start", "close-complete"],
      "aggregate",
    ],
  ] as const) {
    const fixture = await renderFixture(job);
    try {
      expect(fixture.calls).toEqual([...expectedCalls]);
      if (expectedError === "aggregate") {
        expect(fixture.error).toBeInstanceOf(AggregateError);
        expect((fixture.error as AggregateError).errors).toEqual([renderError, closeError]);
      } else expect(fixture.error).toBe(expectedError);
      expect(await Bun.file(fixture.source).text()).toBe(fixture.original);
      expect(
        await import("node:fs/promises").then((fs) =>
          fs.stat(fixture.temporary).catch((error) => error.code),
        ),
      ).toBe("ENOENT");
      if (!expectedError) expect(await Bun.file(fixture.target).text()).toBe("complete artifact");
      else expect(await Bun.file(fixture.target).exists()).toBe(false);
    } finally {
      await rm(fixture.root, { recursive: true, force: true });
    }
  }
});

test("late output competitors and a source symlink cannot be overwritten by publishing", async () => {
  for (const onRender of [
    async (source: string, target: string) => {
      await symlink(source, target);
    },
    async (_source: string, target: string) => {
      await writeFile(target, "competitor output");
    },
  ]) {
    const fixture = await renderFixture({ onRender });
    try {
      expect((fixture.error as Error).message).toBe("replay_render_output_exists");
      expect(await readFile(fixture.source, "utf8")).toBe(fixture.original);
      expect([fixture.original, "competitor output"]).toContain(
        await readFile(fixture.target, "utf8"),
      );
      expect(fixture.calls.slice(-2)).toEqual(["close-start", "close-complete"]);
    } finally {
      await rm(fixture.root, { recursive: true, force: true });
    }
  }
});
