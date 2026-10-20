/** 负责按声线选择合成适配器。输入为服务商注册表，输出统一端口；允许同片混用，构造和离线检查均不读取凭据或联网。 */
import type { VoiceProfile } from "../../src/speech";
import type { SpeechProvider } from "./provider";
import { TencentSpeechProvider } from "./tencent";
import { VolcengineSpeechProvider } from "./volcengine";

export function createSpeechProvider(
  providers: Partial<Record<VoiceProfile["provider"], SpeechProvider>> = {
    tencent: new TencentSpeechProvider(),
    volcengine: new VolcengineSpeechProvider(),
  },
): SpeechProvider {
  return {
    synthesize(request) {
      const provider = providers[request.voice.provider];
      if (!provider) throw new Error("tts_provider_missing");
      return provider.synthesize(request);
    },
  };
}
