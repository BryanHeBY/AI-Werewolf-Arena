/** 负责声线参数校验与合成身份。输入为服务商联合声线，输出稳定请求参数和语速倍率；显示名与字幕编辑不改变音频缓存。 */
import type { VoiceProfile } from "./speech";
import { tencentSpeedRatio } from "./speech-speed";

export function validateVoiceProfile(voice: VoiceProfile): void {
  if (!voice || typeof voice.name !== "string" || !voice.name.trim())
    throw new Error("tts_voice_invalid");
  if (voice.provider === "tencent") {
    if (
      !Number.isSafeInteger(voice.voiceId) ||
      voice.voiceId < 1 ||
      !["premium", "large-model", "ultra-natural"].includes(voice.tier) ||
      ![8000, 16000, 24000].includes(voice.sampleRate ?? 24000) ||
      !Number.isFinite(voice.speed ?? 0) ||
      (voice.speed ?? 0) < -2 ||
      (voice.speed ?? 0) > 6 ||
      !Number.isFinite(voice.volume ?? 0) ||
      (voice.volume ?? 0) < -10 ||
      (voice.volume ?? 0) > 10
    )
      throw new Error("tts_voice_invalid");
    if (voice.tier === "premium" && (voice.sampleRate ?? 24000) === 24000)
      throw new Error("tts_premium_requires_16k_or_8k");
  } else if (voice.provider === "volcengine") {
    if (
      typeof voice.voiceId !== "string" ||
      !/^[a-zA-Z0-9_-]+$/.test(voice.voiceId) ||
      voice.resourceId !== "seed-tts-2.0" ||
      ![8000, 16000, 22050, 24000, 32000, 44100, 48000].includes(voice.sampleRate ?? 24000) ||
      !Number.isSafeInteger(voice.speechRate ?? 0) ||
      (voice.speechRate ?? 0) < -50 ||
      (voice.speechRate ?? 0) > 100 ||
      !Number.isSafeInteger(voice.loudnessRate ?? 0) ||
      (voice.loudnessRate ?? 0) < -50 ||
      (voice.loudnessRate ?? 0) > 100 ||
      (voice.contextTexts !== undefined &&
        (!Array.isArray(voice.contextTexts) ||
          voice.contextTexts.some((text) => typeof text !== "string" || !text.trim())))
    )
      throw new Error("tts_voice_invalid");
  } else throw new Error("tts_provider_unknown");
}
export function speechSynthesisIdentity(voice: VoiceProfile) {
  validateVoiceProfile(voice);
  return voice.provider === "tencent"
    ? {
        api: "TextToVoice-2019-08-23",
        provider: voice.provider,
        voiceId: voice.voiceId,
        sampleRate: voice.sampleRate ?? 24000,
        speed: voice.speed ?? 0,
        volume: voice.volume ?? 0,
      }
    : {
        api: "volcengine-tts-v3-sse-2.0",
        provider: voice.provider,
        voiceId: voice.voiceId,
        sampleRate: voice.sampleRate ?? 24000,
        resourceId: voice.resourceId,
        speechRate: voice.speechRate ?? 0,
        loudnessRate: voice.loudnessRate ?? 0,
        contextTexts: voice.contextTexts ?? [],
      };
}
export function voiceSpeedRatio(voice: VoiceProfile): number {
  validateVoiceProfile(voice);
  return voice.provider === "tencent"
    ? tencentSpeedRatio(voice.speed ?? 0)
    : 1 + (voice.speechRate ?? 0) / 100;
}
