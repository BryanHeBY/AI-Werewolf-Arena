/** 负责定义离线合成与对齐端口。输入为明确台词和声线，输出PCM WAV及可选文字时间；不持有凭据，服务商协议仅由适配器处理。 */
import type { VoiceProfile } from "@ai-werewolf-arena/game-media/speech";
import type { SpeechAlignment } from "@ai-werewolf-arena/game-media/speech-timing";
export type SpeechHttpRequest = (input: string, init: RequestInit) => Promise<Response>;

export interface SynthesisRequest {
  text: string;
  voice: VoiceProfile;
}
export interface SynthesisResult {
  audio: Uint8Array;
  requestId?: string;
  alignment?: SpeechAlignment;
}
export interface SpeechProvider {
  synthesize(request: SynthesisRequest): Promise<SynthesisResult>;
}
/** 对齐器可由本地模型实现；输出时间相对于输入音频，不重新识别或改写剧本文字。 */
export interface SpeechAligner {
  align(request: { text: string; audio: Uint8Array }): Promise<SpeechAlignment>;
}
