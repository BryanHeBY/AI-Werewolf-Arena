/** 负责豆包2.0首次试听选角。输入为公开通用短句，输出三种声线的离线合成稿；只导出数据，导入时不调用云端。 */
import { defineSpeechProject, type VolcengineVoiceProfile } from "../../../src/speech";

const voice = (voiceId: string, name: string): VolcengineVoiceProfile => ({
  provider: "volcengine",
  resourceId: "seed-tts-2.0",
  voiceId,
  name,
  sampleRate: 24000,
  speechRate: 20,
});
export default defineSpeechProject({
  casting: {
    god: voice("zh_male_m191_uranus_bigtts", "云舟 2.0"),
    "player:1": voice("zh_female_vv_uranus_bigtts", "Vivi 2.0"),
    "player:2": voice("zh_female_xiaohe_uranus_bigtts", "小何 2.0"),
  },
  subtitles: { maxCharacters: 24, requireTiming: true },
  lines: [
    { id: "yunzhou", speaker: "god", text: "天黑请闭眼，狼人请睁眼。天亮了，现在开始发言。" },
    {
      id: "vivi",
      speaker: "player:1",
      text: "我先说一下我的判断。请大家认真听，接下来这句话很关键。",
    },
    {
      id: "xiaohe",
      speaker: "player:2",
      text: "我先说一下我的判断。请大家认真听，接下来这句话很关键。",
    },
  ],
});
