/** 合成协议测试负责核对鉴权、语速和碎片化响应。输入为模拟HTTP字节，预期不丢音频、不重复偏移字幕，截断及错误响应不进入成功路径。 */
import { expect, test } from "bun:test";
import { TencentSpeechProvider } from "../../../../../apps/video/scripts/tts/tencent";
import { VolcengineSpeechProvider } from "../../../../../apps/video/scripts/tts/volcengine";
import { createSpeechProvider } from "../../../../../apps/video/scripts/tts/providers";
import { speechRequests } from "../../../../../apps/video/scripts/tts/prepare";
import { voiceSpeedRatio } from "../../../../../apps/video/scripts/tts/voices";
import { readPcmWav, writePcmWav } from "../../../../../apps/video/scripts/tts/wav";
import type { VolcengineVoiceProfile, SpeechProject } from "../../../src/speech";

const voice: VolcengineVoiceProfile = {
  provider: "volcengine",
  voiceId: "zh_female_vv_uranus_bigtts",
  resourceId: "seed-tts-2.0",
  name: "Vivi 2.0",
  speechRate: 50,
  contextTexts: ["用自然、平静的语气说话。"],
};
async function withEnv<T>(values: Record<string, string>, run: () => Promise<T>): Promise<T> {
  const original = Object.fromEntries(Object.keys(values).map((key) => [key, process.env[key]]));
  Object.assign(process.env, values);
  try {
    return await run();
  } finally {
    for (const [key, value] of Object.entries(original))
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
  }
}
function sse(frames: unknown[]) {
  const bytes = new TextEncoder().encode(
    frames.map((value) => `event: 352\r\ndata: ${JSON.stringify(value)}\r\n\r\n`).join(""),
  );
  return new Response(
    new ReadableStream({
      start(controller) {
        // 固定七字节包刻意切开中文UTF8、JSON、CRLF和base64。
        for (let offset = 0; offset < bytes.length; offset += 7)
          controller.enqueue(bytes.slice(offset, offset + 7));
        controller.close();
      },
    }),
    { headers: { "content-type": "text/event-stream", "x-tt-logid": "request-123" } },
  );
}
test("Doubao buffers PCM, requests subtitles and preserves whole-request timestamps from later sentences", async () => {
  await withEnv({ VOLCENGINE_TTS_API_KEY: "unit-test-placeholder" }, async () => {
    const pcm = Buffer.alloc(24000 * 2);
    let calls = 0;
    const provider = new VolcengineSpeechProvider(async (url, init) => {
      calls++;
      expect(String(url)).toBe("https://openspeech.bytedance.com/api/v3/tts/unidirectional/sse");
      const headers = new Headers(init?.headers);
      expect(headers.get("x-api-key")).toBe("unit-test-placeholder");
      expect(headers.get("x-api-resource-id")).toBe("seed-tts-2.0");
      expect(headers.has("x-api-app-id")).toBe(false);
      const { req_params: params } = JSON.parse(String(init?.body));
      expect(params.audio_params).toEqual({
        format: "pcm",
        sample_rate: 24000,
        speech_rate: 50,
        loudness_rate: 0,
        enable_subtitle: true,
      });
      expect(JSON.parse(params.additions)).toEqual({
        max_length_to_filter_parenthesis: 0,
        context_texts: voice.contextTexts,
      });
      return sse([
        { code: 0, data: pcm.subarray(0, 1333).toString("base64") },
        { code: 0, sentence: { words: [{ word: "你好。", startTime: 0.1, endTime: 0.4 }] } },
        { code: 0, data: pcm.subarray(1333).toString("base64") },
        { code: 0, sentence: { words: [{ word: "再见。", startTime: 0.6, endTime: 0.9 }] } },
        { code: 20000000, data: null },
      ]);
    });
    const result = await provider.synthesize({ text: "你好。再见。", voice });
    expect(calls).toBe(1);
    expect(readPcmWav(result.audio).pcm.equals(pcm)).toBe(true);
    expect(result.alignment?.spans).toEqual([
      { text: "你好。", startMs: 100, endMs: 400 },
      { text: "再见。", startMs: 600, endMs: 900 },
    ]);
    expect(result.requestId).toBe("request-123");
  });
});
test("Doubao rejects incomplete or failed streams without retrying or exposing server messages", async () => {
  await withEnv({ VOLCENGINE_TTS_API_KEY: "unit-test-placeholder" }, async () => {
    let calls = 0;
    const provider = new VolcengineSpeechProvider(async () => {
      calls++;
      return sse([{ code: 0, data: "AAAAAA==" }]);
    });
    await expect(provider.synthesize({ text: "测试", voice })).rejects.toThrow(
      "tts_volcengine_stream_incomplete",
    );
    expect(calls).toBe(1);
    const failed = new VolcengineSpeechProvider(async () =>
      sse([{ code: 45000000, message: "server echoed sensitive content" }]),
    );
    await expect(failed.synthesize({ text: "测试", voice })).rejects.toThrow(
      "tts_volcengine:45000000",
    );
  });
});
test("legacy Doubao auth uses speech App ID and Access Token only when no API key is supplied", async () => {
  await withEnv(
    {
      VOLCENGINE_TTS_API_KEY: "",
      VOLCENGINE_TTS_APP_ID: "test-app",
      VOLCENGINE_TTS_ACCESS_TOKEN: "test-token",
    },
    async () => {
      const provider = new VolcengineSpeechProvider(async (_, init) => {
        const headers = new Headers(init?.headers);
        expect(headers.get("x-api-app-id")).toBe("test-app");
        expect(headers.get("x-api-access-key")).toBe("test-token");
        expect(headers.has("x-api-key")).toBe(false);
        return sse([{ code: 0, data: "AAAAAA==" }, { code: 20000000 }]);
      });
      expect((await provider.synthesize({ text: "测试", voice })).alignment).toBeUndefined();
    },
  );
});
test("Tencent requests native subtitles but leaves unavailable super-natural timing absent", async () => {
  await withEnv(
    { TENCENTCLOUD_SECRET_ID: "unit-test-id", TENCENTCLOUD_SECRET_KEY: "unit-test-key" },
    async () => {
      let timed = true;
      const provider = new TencentSpeechProvider(async (_, init) => {
        const request = JSON.parse(String(init?.body));
        expect(request.EnableSubtitle).toBe(true);
        expect(request.Speed).toBe(2);
        return Response.json({
          Response: {
            SessionId: request.SessionId,
            Audio: writePcmWav(Buffer.alloc(48000), 24000).toString("base64"),
            Subtitles: timed ? [{ Text: "你好", BeginTime: 100, EndTime: 500 }] : [],
          },
        });
      });
      const result = await provider.synthesize({
        text: "你好",
        voice: {
          provider: "tencent",
          voiceId: 402002,
          name: "云大围",
          tier: "ultra-natural",
          speed: 2,
        },
      });
      expect(result.alignment?.spans).toEqual([{ text: "你好", startMs: 100, endMs: 500 }]);
      timed = false;
      expect(
        (
          await provider.synthesize({
            text: "你好",
            voice: {
              provider: "tencent",
              voiceId: 402002,
              name: "云大围",
              tier: "ultra-natural",
              speed: 2,
            },
          })
        ).alignment,
      ).toBeUndefined();
    },
  );
});
test("voice routing and cache identity distinguish services, style instructions and native speed scales", async () => {
  expect(voiceSpeedRatio(voice)).toBe(1.5);
  const project: SpeechProject = {
    casting: { god: voice },
    lines: [{ id: "one", speaker: "god", text: "你好" }],
  };
  const key = speechRequests(project)[0]!.key;
  project.lines[0]!.voice = { ...voice, name: "改显示名" };
  expect(speechRequests(project)[0]!.key).toBe(key);
  project.lines[0]!.voice = { ...voice, speechRate: 20 };
  expect(speechRequests(project)[0]!.key).not.toBe(key);
  project.lines[0]!.voice = { ...voice, contextTexts: ["更轻松一些。"] };
  expect(speechRequests(project)[0]!.key).not.toBe(key);
  const selected: string[] = [];
  const provider = createSpeechProvider({
    volcengine: {
      async synthesize({ voice }) {
        selected.push(voice.provider);
        return { audio: new Uint8Array() };
      },
    },
  });
  await provider.synthesize({ text: "你好", voice });
  expect(selected).toEqual(["volcengine"]);
});
