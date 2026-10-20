/** 本局六段豆包试听稿。输入为完整JSONL稿的固定节选与本局选角，输出独立试听项目；不改写正式原话，导入时不调用云端。 */
import { defineSpeechProject } from "../../src/speech";
import { casting } from "./casting";

export const sourceLineIds = [
  "intro-title-0",
  "event-2-0",
  "event-7-0",
  "event-54-0",
  "event-31-0",
  "event-33-0",
];

export default defineSpeechProject({
  casting,
  chunkGapMs: 0,
  subtitles: { maxCharacters: 24 },
  lines: [
    {
      id: "doubao-intro-title-0",
      speaker: "narrator",
      text: "我做了一个开源的 AI 狼人杀框架，让十二个 GPT 化身猫娘，各自推理、自主行动，来玩一局狼人杀。",
    },
    {
      id: "doubao-event-2-0",
      speaker: "god",
      text: "进入第1夜，天黑请闭眼。狼人开始夜间交流。",
    },
    {
      id: "doubao-event-7-0",
      speaker: "player:8",
      text: "碰爪确认，我是狼美人，首刀跟9号，5号主跳就按这个安排走喵。我先留警下，不把队形挤成一团，听完两边再找自然的站边理由喵。",
    },
    {
      id: "doubao-event-54-0",
      speaker: "player:2",
      text: "2号这票给4，目前还是稍偏4，不是拿三票对七票赌气喵。警上让我不太舒服的是5号把4号的警徽流说成警下没有明确落点，可4原本就明确报了5、11，也提前交代遇到对跳会调整，这套说法本身是连贯的喵。",
    },
    {
      id: "doubao-event-31-0",
      speaker: "player:4",
      text: "4号预言家，昨晚查验9号是好人，9号金水喵。首验没发言可听，我选了隔开位置的9号，没有额外故事，也不会把金水说成民牌喵。",
    },
    {
      id: "doubao-event-33-0",
      speaker: "player:11",
      text: "11号不是预言家，上警来听两位怎么亮爪子，待会儿退水，把警徽留给预言家争喵。现在我稍偏4号，但只是半只爪子的倾向，不是已经认准喵。",
    },
  ],
});
