/** 负责豆包主持人与玩家的固定选角装配。输入为明确席位和音色，输出可复用声线；不随机、不合成，也不改变缓存身份。 */
import type { SpeechProject, VolcengineVoiceProfile } from "../../src/speech";

type VoiceSelection = readonly [voiceId: string, name: string];
export function createDoubaoCasting(
  players: Record<`player:${number}`, VoiceSelection>,
  playerStyle: string,
): SpeechProject["casting"] {
  const voice = ([voiceId, name]: VoiceSelection, style: string): VolcengineVoiceProfile => ({
    provider: "volcengine",
    resourceId: "seed-tts-2.0",
    voiceId,
    name,
    sampleRate: 24000,
    speechRate: 20,
    contextTexts: [style],
  });
  return {
    narrator: voice(
      ["zh_male_jieshuoxiaoming_uranus_bigtts", "解说小明 2.0"],
      "用自然、清晰的游戏解说口吻介绍，轻松平实，不夸张。",
    ),
    god: voice(
      ["zh_female_meilinvyou_uranus_bigtts", "魅力女友 2.0"],
      "用清晰、平稳的狼人杀主持人口吻播报，语气克制，停顿自然。",
    ),
    ...Object.fromEntries(
      Object.entries(players).map(([speaker, selection]) => [
        speaker,
        voice(selection, playerStyle),
      ]),
    ),
  };
}
