/** 负责适配Tencent TextToVoice。输入为文字和声线，输出WAV、可用时间戳与请求ID；凭据只从进程环境读取，不进入日志或缓存。 */
import { createHash, createHmac, randomUUID } from "node:crypto";
import type {
  SpeechHttpRequest,
  SpeechProvider,
  SynthesisRequest,
  SynthesisResult,
} from "./provider";
import { validateVoiceProfile } from "./voices";
const hash = (text: string) => createHash("sha256").update(text).digest("hex");
const hmac = (key: string | Buffer, value: string): Buffer =>
  createHmac("sha256", key).update(value).digest();

export class TencentSpeechProvider implements SpeechProvider {
  constructor(private readonly request: SpeechHttpRequest = fetch) {}
  async synthesize({ text, voice }: SynthesisRequest): Promise<SynthesisResult> {
    validateVoiceProfile(voice);
    if (voice.provider !== "tencent") throw new Error("tts_provider_mismatch");
    const secretId = process.env.TENCENTCLOUD_SECRET_ID?.trim();
    const secretKey = process.env.TENCENTCLOUD_SECRET_KEY?.trim();
    if (!secretId || !secretKey) throw new Error("tts_credentials_missing");
    const sessionId = randomUUID();
    const body = JSON.stringify({
      Text: text,
      SessionId: sessionId,
      VoiceType: voice.voiceId,
      ModelType: 1,
      PrimaryLanguage: 1,
      Codec: "wav",
      SampleRate: voice.sampleRate ?? 24000,
      Speed: voice.speed ?? 0,
      Volume: voice.volume ?? 0,
      EnableSubtitle: true,
    });
    const timestamp = Math.floor(Date.now() / 1000);
    const date = new Date(timestamp * 1000).toISOString().slice(0, 10);
    const scope = `${date}/tts/tc3_request`;
    const canonical = [
      "POST",
      "/",
      "",
      "content-type:application/json; charset=utf-8\nhost:tts.tencentcloudapi.com\n",
      "content-type;host",
      hash(body),
    ].join("\n");
    const key = hmac(hmac(hmac(`TC3${secretKey}`, date), "tts"), "tc3_request");
    const signature = hmac(
      key,
      ["TC3-HMAC-SHA256", String(timestamp), scope, hash(canonical)].join("\n"),
    ).toString("hex");
    let response: Response;
    try {
      response = await this.request("https://tts.tencentcloudapi.com/", {
        method: "POST",
        redirect: "error",
        signal: AbortSignal.timeout(60000),
        body,
        headers: {
          "content-type": "application/json; charset=utf-8",
          authorization: `TC3-HMAC-SHA256 Credential=${secretId}/${scope}, SignedHeaders=content-type;host, Signature=${signature}`,
          "x-tc-action": "TextToVoice",
          "x-tc-version": "2019-08-23",
          "x-tc-timestamp": String(timestamp),
        },
      });
    } catch {
      throw new Error("tts_network_failed_no_automatic_retry");
    }
    let data: Record<string, unknown>;
    try {
      data = ((await response.json()) as { Response: Record<string, unknown> }).Response;
    } catch {
      throw new Error("tts_response_invalid");
    }
    if (!data) throw new Error("tts_response_invalid");
    const error = data.Error as { Code?: unknown } | undefined;
    if (error) {
      const code =
        typeof error.Code === "string" && /^[A-Za-z0-9_.]{1,160}$/.test(error.Code)
          ? error.Code
          : "unknown";
      throw new Error(`tts_tencent:${code}`);
    }
    if (!response.ok || data.SessionId !== sessionId || typeof data.Audio !== "string")
      throw new Error("tts_response_invalid");
    if (data.Subtitles !== undefined && !Array.isArray(data.Subtitles))
      throw new Error("tts_response_invalid");
    const spans = ((data.Subtitles ?? []) as Array<Record<string, unknown>>).map((item) => {
      if (
        !item ||
        typeof item.Text !== "string" ||
        typeof item.BeginTime !== "number" ||
        typeof item.EndTime !== "number"
      )
        throw new Error("tts_response_invalid");
      return { text: item.Text, startMs: item.BeginTime, endMs: item.EndTime };
    });
    return {
      audio: Buffer.from(data.Audio, "base64"),
      ...(spans.length ? { alignment: { source: "provider" as const, spans } } : {}),
      ...(typeof data.RequestId === "string" && /^[A-Za-z0-9-]{1,100}$/.test(data.RequestId)
        ? { requestId: data.RequestId }
        : {}),
    };
  }
}
