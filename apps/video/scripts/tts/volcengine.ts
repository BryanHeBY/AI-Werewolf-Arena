/** 负责豆包2.0单向HTTP SSE适配。输入为完整合成块与声线，输出PCM WAV和字级时间；读取完结束事件才提交，不将流分包误当音频边界。 */
import { randomUUID } from "node:crypto";
import type { SpeechTextTiming } from "@ai-werewolf-arena/game-media/speech-timing";
import type {
  SpeechHttpRequest,
  SpeechProvider,
  SynthesisRequest,
  SynthesisResult,
} from "./provider";
import { validateVoiceProfile } from "./voices";
import { writePcmWav } from "./wav";

async function readSse(response: Response) {
  if (!response.ok || !response.body) throw new Error(`tts_volcengine_http:${response.status}`);
  const audio: Buffer[] = [],
    spans: SpeechTextTiming[] = [];
  let complete = false,
    pending = "",
    payload: string[] = [],
    bytes = 0;
  const consume = () => {
    if (!payload.length) return;
    let value: Record<string, unknown>;
    try {
      value = JSON.parse(payload.join("\n"));
    } catch {
      throw new Error("tts_volcengine_response_invalid");
    }
    payload = [];
    if (!value || typeof value.code !== "number" || !Number.isSafeInteger(value.code) || complete)
      throw new Error("tts_volcengine_response_invalid");
    if (value.code === 20000000) complete = true;
    else if (value.code !== 0) throw new Error(`tts_volcengine:${value.code}`);
    if (value.data !== undefined && value.data !== null && value.data !== "") {
      if (typeof value.data !== "string" || !/^[A-Za-z0-9+/]*={0,2}$/.test(value.data))
        throw new Error("tts_volcengine_response_invalid");
      const part = Buffer.from(value.data, "base64");
      bytes += part.length;
      if (bytes > 64 * 1024 * 1024) throw new Error("tts_volcengine_audio_too_large");
      audio.push(part);
    }
    if (value.sentence !== undefined && value.sentence !== null) {
      const sentence = value.sentence as { words?: unknown };
      if (!Array.isArray(sentence.words)) throw new Error("tts_volcengine_response_invalid");
      for (const item of sentence.words) {
        if (
          !item ||
          typeof item.word !== "string" ||
          typeof item.startTime !== "number" ||
          typeof item.endTime !== "number"
        )
          throw new Error("tts_volcengine_response_invalid");
        // 后续句的时间已相对于整个请求；这里不再次叠加句起点。
        spans.push({ text: item.word, startMs: item.startTime * 1000, endMs: item.endTime * 1000 });
      }
    }
  };
  const line = (value: string) => {
    if (!value) consume();
    else if (value.startsWith("data:")) payload.push(value.slice(5).replace(/^ /, ""));
  };
  const reader = response.body.getReader(),
    decoder = new TextDecoder("utf-8", { fatal: true });
  try {
    while (true) {
      const { done, value } = await reader.read();
      pending += done ? decoder.decode() : decoder.decode(value, { stream: true });
      let boundary: number;
      while ((boundary = pending.indexOf("\n")) >= 0) {
        line(pending.slice(0, boundary).replace(/\r$/, ""));
        pending = pending.slice(boundary + 1);
      }
      if (pending.length > 8 * 1024 * 1024) throw new Error("tts_volcengine_response_invalid");
      if (done) break;
    }
    if (pending) line(pending.replace(/\r$/, ""));
    consume();
    if (!complete || !bytes || bytes % 2) throw new Error("tts_volcengine_stream_incomplete");
    spans.sort((a, b) => a.startMs - b.startMs);
    return { pcm: Buffer.concat(audio), spans };
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
export class VolcengineSpeechProvider implements SpeechProvider {
  constructor(private readonly request: SpeechHttpRequest = fetch) {}
  async synthesize({ text, voice }: SynthesisRequest): Promise<SynthesisResult> {
    validateVoiceProfile(voice);
    if (voice.provider !== "volcengine") throw new Error("tts_provider_mismatch");
    const apiKey = process.env.VOLCENGINE_TTS_API_KEY?.trim();
    const appId = process.env.VOLCENGINE_TTS_APP_ID?.trim();
    const token = process.env.VOLCENGINE_TTS_ACCESS_TOKEN?.trim();
    if (!apiKey && (!appId || !token)) throw new Error("tts_volcengine_credentials_missing");
    const sampleRate = voice.sampleRate ?? 24000;
    try {
      const response = await this.request(
        "https://openspeech.bytedance.com/api/v3/tts/unidirectional/sse",
        {
          method: "POST",
          redirect: "error",
          signal: AbortSignal.timeout(180000),
          headers: {
            "content-type": "application/json",
            accept: "text/event-stream",
            "x-api-resource-id": voice.resourceId,
            "x-api-request-id": randomUUID(),
            ...(apiKey
              ? { "x-api-key": apiKey }
              : { "x-api-app-id": appId!, "x-api-access-key": token! }),
          },
          body: JSON.stringify({
            req_params: {
              text,
              speaker: voice.voiceId,
              audio_params: {
                format: "pcm",
                sample_rate: sampleRate,
                speech_rate: voice.speechRate ?? 0,
                loudness_rate: voice.loudnessRate ?? 0,
                enable_subtitle: true,
              },
              additions: JSON.stringify({
                max_length_to_filter_parenthesis: 0,
                ...(voice.contextTexts?.length ? { context_texts: voice.contextTexts } : {}),
              }),
            },
          }),
        },
      );
      const { pcm, spans } = await readSse(response);
      const requestId = response.headers.get("x-tt-logid");
      return {
        audio: writePcmWav(pcm, sampleRate),
        ...(spans.length ? { alignment: { source: "provider", spans } } : {}),
        ...(requestId && /^[A-Za-z0-9-]{1,100}$/.test(requestId) ? { requestId } : {}),
      };
    } catch (error) {
      if (error instanceof Error && /^tts_volcengine[a-zA-Z0-9_:]*$/.test(error.message))
        throw error;
      throw new Error("tts_network_failed_no_automatic_retry");
    }
  }
}
