/** 负责本局完整画面底稿。输入为原生前端脚本副本，输出可直接编辑的片头与全部镜头；口播和玩家全文引用speech.jsonl，不重复维护。 */
import type { VideoScript } from "../../src/video/plan";
import { speechSceneCues, speechSceneDialogue } from "../../src/speech-script";
import { speechScript } from "./dialogue";
export const script: VideoScript = {
  source: {
    sessionId: "session_1792443889532_ltr2qg",
    fingerprint: "fnv1a64:d43f10ec1df6b515",
  },
  layout: "broadcast-v1",
  theme: {
    id: "gothic-v1",
  },
  fps: 30,
  width: 1920,
  height: 1080,
  pacing: "narration",
  subtitles: {
    lingerMs: 400,
  },
  intro: [
    {
      id: "title",
      durationFrames: 360,
      readingClock: "flow",
      scene: {
        kind: "phase",
        title: "12 个 GLM 猫娘玩狼人杀",
        body: "连出两狼占尽先机，骑士一剑风向骤变",
        speaker: "narrator",
        bodySource: "script",
        bodyLayout: "text",
        cues: {
          establish: 0,
          travel: 0,
          impact: 0,
          settled: 0,
        },
        textLayout: "title",
        credits: {
          description: "开源多智能体狼人杀框架",
          repository: "BryanHeBY/AI-Werewolf-Arena",
          agent: "pi-agent",
          features: ["独立会话", "工具调用", "事件复盘"],
        },
      },
      speech: speechSceneCues(speechScript, "intro:title"),
    },
    {
      id: "rules",
      durationFrames: 600,
      readingClock: "flow",
      scene: {
        kind: "phase",
        title: "对局信息 · 狼美人骑士",
        body: "阵容：3 狼人＋狼美人，4 平民，预言家、女巫、守卫、骑士。\n胜负：好人清狼；狼人屠神或屠民。\n\n狼美人：每夜可魅惑一人；放逐或毒杀会牵连，骑士决斗不触发。\n骑士：一次决斗，命中狼人直接入夜，误中好人自己出局。\n守卫：不能连守同一人，同守同救抵消；女巫不能自救。\n出局不翻牌；警长 1.5 票，出局后警徽按存活座位顺位移交。",
        speaker: "narrator",
        bodySource: "script",
        bodyLayout: "text",
        cues: {
          establish: 0,
          travel: 0,
          impact: 0,
          settled: 0,
        },
        notes: {
          title: "模型与人格配置",
          body: "模型：GLM-5.3 × 12　·　基于 pi-agent，独立会话。\n提示词节选：「本局你是一位可爱的猫娘玩家。」\n「每一句完整的自然语言句子都必须以“喵”收尾。」\n软萌俏皮、认真争胜；发言、投票与技能由 Agent 自主决定。",
        },
      },
      speech: speechSceneCues(speechScript, "intro:rules"),
      emphasis: [
        {
          text: "3 狼人＋狼美人",
          color: "#ff8e9e",
        },
        {
          text: "4 平民",
          color: "#91c8e8",
        },
        {
          text: "好人清狼",
          color: "#9cdbb9",
        },
        {
          text: "骑士决斗不触发",
          color: "#f3ce7a",
        },
        {
          text: "出局不翻牌",
          color: "#f3ce7a",
        },
        {
          text: "顺位移交",
          color: "#f3ce7a",
        },
      ],
    },
  ],
  edits: [
    {
      anchor: {
        seq: 1,
        type: "god_private_game_info",
      },
      durationFrames: 90,
      readingClock: "flow",
      scene: {
        title: "身份与阵营",
      },
      speech: [
        {
          speaker: "god",
          text: "身份分配完毕，游戏正式开始。",
        },
      ],
    },
    {
      anchor: {
        seq: 3,
        type: "wolf_tactical_order",
      },
      skip: true,
    },
    {
      anchor: {
        seq: 13,
        type: "wolf_kill_vote_cast",
      },
      skip: true,
    },
    {
      anchor: {
        seq: 14,
        type: "wolf_kill_vote_cast",
      },
      skip: true,
    },
    {
      anchor: {
        seq: 15,
        type: "wolf_kill_vote_cast",
      },
      skip: true,
    },
    {
      anchor: {
        seq: 16,
        type: "wolf_kill_vote_cast",
      },
      skip: true,
    },
    {
      anchor: {
        seq: 48,
        type: "sheriff_candidates_finalized",
      },
      skip: true,
    },
    {
      anchor: {
        seq: 76,
        type: "phase_changed",
      },
      skip: true,
    },
    {
      anchor: {
        seq: 91,
        type: "last_words_granted",
      },
      skip: true,
    },
    {
      anchor: {
        seq: 94,
        type: "wolf_tactical_order",
      },
      skip: true,
    },
    {
      anchor: {
        seq: 102,
        type: "wolf_kill_vote_cast",
      },
      skip: true,
    },
    {
      anchor: {
        seq: 103,
        type: "wolf_kill_vote_cast",
      },
      skip: true,
    },
    {
      anchor: {
        seq: 104,
        type: "wolf_kill_vote_cast",
      },
      skip: true,
    },
    {
      anchor: {
        seq: 120,
        type: "phase_changed",
      },
      skip: true,
    },
    {
      anchor: {
        seq: 133,
        type: "last_words_granted",
      },
      skip: true,
    },
    {
      anchor: {
        seq: 136,
        type: "wolf_tactical_order",
      },
      skip: true,
    },
    {
      anchor: {
        seq: 142,
        type: "wolf_kill_vote_cast",
      },
      skip: true,
    },
    {
      anchor: {
        seq: 143,
        type: "wolf_kill_vote_cast",
      },
      skip: true,
    },
    {
      anchor: {
        seq: 157,
        type: "knight_duel",
      },
      lifeFacts: [
        {
          seq: 12,
          kind: "life_committed",
        },
      ],
    },
    {
      anchor: {
        seq: 158,
        type: "last_words_granted",
      },
      skip: true,
    },
    {
      anchor: {
        seq: 160,
        type: "phase_changed",
      },
      skip: true,
    },
    {
      anchor: {
        seq: 170,
        type: "last_words_granted",
      },
      skip: true,
    },
    {
      anchor: {
        seq: 173,
        type: "wolf_tactical_order",
      },
      skip: true,
    },
    {
      anchor: {
        seq: 178,
        type: "wolf_kill_vote_cast",
      },
      skip: true,
    },
    {
      anchor: {
        seq: 179,
        type: "wolf_kill_vote_cast",
      },
      skip: true,
    },
    {
      anchor: {
        seq: 182,
        type: "phase_changed",
      },
      skip: true,
    },
  ],
  factEdits: [],
  shotEdits: [
    {
      id: "event:1",
      scene: {
        title: "身份与阵营",
        body: "角色分布：1号：平民，2号：平民，3号：狼人，4号：女巫，5号：预言家，6号：平民，7号：狼美人，8号：骑士，9号：守卫，10号：狼人，11号：狼人，12号：平民",
        bodySource: "event",
        bodyLayout: "structured",
      },
      speech: speechSceneCues(speechScript, "event:1"),
      camera: [
        {
          frame: 0,
          target: "table",
        },
      ],
      layers: [],
    },
    {
      id: "event:2",
      scene: {
        title: "阶段交替",
        body: "第1天夜晚，天黑请闭眼",
        bodySource: "event",
        bodyLayout: "structured",
      },
      speech: speechSceneCues(speechScript, "event:2"),
      camera: [
        {
          frame: 0,
          target: "table",
        },
      ],
      layers: [],
    },
    {
      id: "event:4",
      scene: {
        title: "狼人交流",
        body: speechSceneDialogue(speechScript, "event:4"),
        bodySource: "event",
        bodyLayout: "structured",
      },
      speech: speechSceneCues(speechScript, "event:4"),
      camera: [
        {
          frame: 0,
          target: "table",
        },
      ],
      layers: [],
    },
    {
      id: "event:5",
      scene: {
        title: "狼人交流",
        body: speechSceneDialogue(speechScript, "event:5"),
        bodySource: "event",
        bodyLayout: "structured",
      },
      speech: speechSceneCues(speechScript, "event:5"),
      camera: [
        {
          frame: 0,
          target: "table",
        },
      ],
      layers: [],
    },
    {
      id: "event:6",
      scene: {
        title: "狼人交流",
        body: speechSceneDialogue(speechScript, "event:6"),
        bodySource: "event",
        bodyLayout: "structured",
      },
      speech: speechSceneCues(speechScript, "event:6"),
      camera: [
        {
          frame: 0,
          target: "table",
        },
      ],
      layers: [],
    },
    {
      id: "event:7",
      scene: {
        title: "狼人交流",
        body: speechSceneDialogue(speechScript, "event:7"),
        bodySource: "event",
        bodyLayout: "structured",
      },
      speech: speechSceneCues(speechScript, "event:7"),
      camera: [
        {
          frame: 0,
          target: "table",
        },
      ],
      layers: [],
    },
    {
      id: "event:8",
      scene: {
        title: "狼人交流",
        body: speechSceneDialogue(speechScript, "event:8"),
        bodySource: "event",
        bodyLayout: "structured",
      },
      speech: speechSceneCues(speechScript, "event:8"),
      camera: [
        {
          frame: 0,
          target: "table",
        },
      ],
      layers: [],
    },
    {
      id: "event:9",
      scene: {
        title: "狼人交流",
        body: speechSceneDialogue(speechScript, "event:9"),
        bodySource: "event",
        bodyLayout: "structured",
      },
      speech: speechSceneCues(speechScript, "event:9"),
      camera: [
        {
          frame: 0,
          target: "table",
        },
      ],
      layers: [],
    },
    {
      id: "event:10",
      scene: {
        title: "狼人交流",
        body: speechSceneDialogue(speechScript, "event:10"),
        bodySource: "event",
        bodyLayout: "structured",
      },
      speech: speechSceneCues(speechScript, "event:10"),
      camera: [
        {
          frame: 0,
          target: "table",
        },
      ],
      layers: [],
    },
    {
      id: "event:11",
      scene: {
        title: "狼人交流",
        body: speechSceneDialogue(speechScript, "event:11"),
        bodySource: "event",
        bodyLayout: "structured",
      },
      speech: speechSceneCues(speechScript, "event:11"),
      camera: [
        {
          frame: 0,
          target: "table",
        },
      ],
      layers: [],
    },
    {
      id: "event:12",
      scene: {
        title: "守卫行动",
        body: "9号守护9号",
        bodySource: "event",
        bodyLayout: "structured",
      },
      speech: speechSceneCues(speechScript, "event:12"),
      camera: [
        {
          frame: 0,
          target: "table",
        },
      ],
      layers: [],
    },
    {
      id: "fact:2",
      scene: {
        title: "狼刀确认",
        body: "本次狼刀目标：12号。",
        bodySource: "event",
        bodyLayout: "structured",
      },
      speech: speechSceneCues(speechScript, "fact:2"),
      camera: [
        {
          frame: 0,
          target: "table",
        },
      ],
      layers: [],
    },
    {
      id: "event:17",
      scene: {
        title: "魅惑选择",
        body: "7号狼美人本夜魅惑目标：无（第1夜）",
        bodySource: "event",
        bodyLayout: "structured",
      },
      speech: speechSceneCues(speechScript, "event:17"),
      camera: [
        {
          frame: 0,
          target: "table",
        },
      ],
      layers: [],
    },
    {
      id: "event:18",
      scene: {
        title: "女巫行动",
        body: "4号对12号使用解药",
        bodySource: "event",
        bodyLayout: "structured",
      },
      speech: speechSceneCues(speechScript, "event:18"),
      camera: [
        {
          frame: 0,
          target: "table",
        },
      ],
      layers: [],
    },
    {
      id: "event:19",
      scene: {
        title: "预言家行动",
        body: "5号查验7号：狼人",
        bodySource: "event",
        bodyLayout: "structured",
      },
      speech: speechSceneCues(speechScript, "event:19"),
      camera: [
        {
          frame: 0,
          target: "table",
        },
      ],
      layers: [],
    },
    {
      id: "fact:4",
      scene: {
        title: "保护结算",
        body: "12号的狼刀伤害被解药阻止。",
        bodySource: "event",
        bodyLayout: "structured",
      },
      speech: speechSceneCues(speechScript, "fact:4"),
      camera: [
        {
          frame: 0,
          target: "table",
        },
      ],
      layers: [],
    },
    {
      id: "event:20",
      scene: {
        title: "阶段交替",
        body: "第1天白天，天亮了",
        bodySource: "event",
        bodyLayout: "structured",
      },
      speech: speechSceneCues(speechScript, "event:20"),
      camera: [
        {
          frame: 0,
          target: "table",
        },
      ],
      layers: [],
    },
    {
      id: "event:33",
      scene: {
        title: "上警结果",
        body: "上警玩家：1号、2号、3号、5号、6号、10号、12号",
        bodySource: "event",
        bodyLayout: "structured",
      },
      speech: speechSceneCues(speechScript, "event:33"),
      camera: [
        {
          frame: 0,
          target: "table",
        },
      ],
      layers: [],
    },
    {
      id: "event:34",
      scene: {
        title: "白天发言",
        body: speechSceneDialogue(speechScript, "event:34"),
        bodySource: "event",
        bodyLayout: "structured",
      },
      speech: speechSceneCues(speechScript, "event:34"),
      camera: [
        {
          frame: 0,
          target: "table",
        },
      ],
      layers: [],
    },
    {
      id: "event:35",
      scene: {
        title: "白天发言",
        body: speechSceneDialogue(speechScript, "event:35"),
        bodySource: "event",
        bodyLayout: "structured",
      },
      speech: speechSceneCues(speechScript, "event:35"),
      camera: [
        {
          frame: 0,
          target: "table",
        },
      ],
      layers: [],
    },
    {
      id: "event:36",
      scene: {
        title: "白天发言",
        body: speechSceneDialogue(speechScript, "event:36"),
        bodySource: "event",
        bodyLayout: "structured",
      },
      speech: speechSceneCues(speechScript, "event:36"),
      camera: [
        {
          frame: 0,
          target: "table",
        },
      ],
      layers: [],
    },
    {
      id: "event:37",
      scene: {
        title: "白天发言",
        body: speechSceneDialogue(speechScript, "event:37"),
        bodySource: "event",
        bodyLayout: "structured",
      },
      speech: speechSceneCues(speechScript, "event:37"),
      camera: [
        {
          frame: 0,
          target: "table",
        },
      ],
      layers: [],
    },
    {
      id: "event:38",
      scene: {
        title: "白天发言",
        body: speechSceneDialogue(speechScript, "event:38"),
        bodySource: "event",
        bodyLayout: "structured",
      },
      speech: speechSceneCues(speechScript, "event:38"),
      camera: [
        {
          frame: 0,
          target: "table",
        },
      ],
      layers: [],
    },
    {
      id: "event:39",
      scene: {
        title: "白天发言",
        body: speechSceneDialogue(speechScript, "event:39"),
        bodySource: "event",
        bodyLayout: "structured",
      },
      speech: speechSceneCues(speechScript, "event:39"),
      camera: [
        {
          frame: 0,
          target: "table",
        },
      ],
      layers: [],
    },
    {
      id: "event:40",
      scene: {
        title: "白天发言",
        body: speechSceneDialogue(speechScript, "event:40"),
        bodySource: "event",
        bodyLayout: "structured",
      },
      speech: speechSceneCues(speechScript, "event:40"),
      camera: [
        {
          frame: 0,
          target: "table",
        },
      ],
      layers: [],
    },
    {
      id: "event:47",
      scene: {
        title: "退水结果",
        body: "退水玩家：1号、2号、3号、6号、10号、12号",
        bodySource: "event",
        bodyLayout: "structured",
      },
      speech: speechSceneCues(speechScript, "event:47"),
      camera: [
        {
          frame: 0,
          target: "table",
        },
      ],
      layers: [],
    },
    {
      id: "event:60",
      scene: {
        title: "警长票型",
        body: "本轮票型已汇总，详情见票型图。",
        bodySource: "event",
        bodyLayout: "structured",
      },
      speech: speechSceneCues(speechScript, "event:60"),
      camera: [
        {
          frame: 0,
          target: "table",
        },
      ],
      layers: [],
    },
    {
      id: "event:62",
      scene: {
        title: "夜晚结算",
        body: "昨夜是平安夜",
        bodySource: "event",
        bodyLayout: "structured",
      },
      speech: speechSceneCues(speechScript, "event:62"),
      camera: [
        {
          frame: 0,
          target: "table",
        },
      ],
      layers: [],
    },
    {
      id: "event:63",
      scene: {
        title: "警长定序",
        body: "5号选择逆时针（警右）发言",
        bodySource: "event",
        bodyLayout: "structured",
      },
      speech: speechSceneCues(speechScript, "event:63"),
      camera: [
        {
          frame: 0,
          target: "table",
        },
      ],
      layers: [],
    },
    {
      id: "event:64",
      scene: {
        title: "白天发言",
        body: speechSceneDialogue(speechScript, "event:64"),
        bodySource: "event",
        bodyLayout: "structured",
      },
      speech: speechSceneCues(speechScript, "event:64"),
      camera: [
        {
          frame: 0,
          target: "table",
        },
      ],
      layers: [],
    },
    {
      id: "event:65",
      scene: {
        title: "白天发言",
        body: speechSceneDialogue(speechScript, "event:65"),
        bodySource: "event",
        bodyLayout: "structured",
      },
      speech: speechSceneCues(speechScript, "event:65"),
      camera: [
        {
          frame: 0,
          target: "table",
        },
      ],
      layers: [],
    },
    {
      id: "event:66",
      scene: {
        title: "白天发言",
        body: speechSceneDialogue(speechScript, "event:66"),
        bodySource: "event",
        bodyLayout: "structured",
      },
      speech: speechSceneCues(speechScript, "event:66"),
      camera: [
        {
          frame: 0,
          target: "table",
        },
      ],
      layers: [],
    },
    {
      id: "event:67",
      scene: {
        title: "白天发言",
        body: speechSceneDialogue(speechScript, "event:67"),
        bodySource: "event",
        bodyLayout: "structured",
      },
      speech: speechSceneCues(speechScript, "event:67"),
      camera: [
        {
          frame: 0,
          target: "table",
        },
      ],
      layers: [],
    },
    {
      id: "event:68",
      scene: {
        title: "白天发言",
        body: speechSceneDialogue(speechScript, "event:68"),
        bodySource: "event",
        bodyLayout: "structured",
      },
      speech: speechSceneCues(speechScript, "event:68"),
      camera: [
        {
          frame: 0,
          target: "table",
        },
      ],
      layers: [],
    },
    {
      id: "event:69",
      scene: {
        title: "白天发言",
        body: speechSceneDialogue(speechScript, "event:69"),
        bodySource: "event",
        bodyLayout: "structured",
      },
      speech: speechSceneCues(speechScript, "event:69"),
      camera: [
        {
          frame: 0,
          target: "table",
        },
      ],
      layers: [],
    },
    {
      id: "event:70",
      scene: {
        title: "白天发言",
        body: speechSceneDialogue(speechScript, "event:70"),
        bodySource: "event",
        bodyLayout: "structured",
      },
      speech: speechSceneCues(speechScript, "event:70"),
      camera: [
        {
          frame: 0,
          target: "table",
        },
      ],
      layers: [],
    },
    {
      id: "event:71",
      scene: {
        title: "白天发言",
        body: speechSceneDialogue(speechScript, "event:71"),
        bodySource: "event",
        bodyLayout: "structured",
      },
      speech: speechSceneCues(speechScript, "event:71"),
      camera: [
        {
          frame: 0,
          target: "table",
        },
      ],
      layers: [],
    },
    {
      id: "event:72",
      scene: {
        title: "白天发言",
        body: speechSceneDialogue(speechScript, "event:72"),
        bodySource: "event",
        bodyLayout: "structured",
      },
      speech: speechSceneCues(speechScript, "event:72"),
      camera: [
        {
          frame: 0,
          target: "table",
        },
      ],
      layers: [],
    },
    {
      id: "event:73",
      scene: {
        title: "白天发言",
        body: speechSceneDialogue(speechScript, "event:73"),
        bodySource: "event",
        bodyLayout: "structured",
      },
      speech: speechSceneCues(speechScript, "event:73"),
      camera: [
        {
          frame: 0,
          target: "table",
        },
      ],
      layers: [],
    },
    {
      id: "event:74",
      scene: {
        title: "白天发言",
        body: speechSceneDialogue(speechScript, "event:74"),
        bodySource: "event",
        bodyLayout: "structured",
      },
      speech: speechSceneCues(speechScript, "event:74"),
      camera: [
        {
          frame: 0,
          target: "table",
        },
      ],
      layers: [],
    },
    {
      id: "event:75",
      scene: {
        title: "白天发言",
        body: speechSceneDialogue(speechScript, "event:75"),
        bodySource: "event",
        bodyLayout: "structured",
      },
      speech: speechSceneCues(speechScript, "event:75"),
      camera: [
        {
          frame: 0,
          target: "table",
        },
      ],
      layers: [],
    },
    {
      id: "event:89",
      scene: {
        title: "放逐投票",
        body: "本轮票型已汇总，详情见票型图。",
        bodySource: "event",
        bodyLayout: "structured",
      },
      speech: speechSceneCues(speechScript, "event:89"),
      camera: [
        {
          frame: 0,
          target: "table",
        },
      ],
      layers: [],
    },
    {
      id: "fact:5",
      scene: {
        title: "死亡确认",
        body: "7号已死亡。",
        bodySource: "event",
        bodyLayout: "structured",
      },
      speech: speechSceneCues(speechScript, "fact:5"),
      camera: [
        {
          frame: 0,
          target: "table",
        },
      ],
      layers: [],
    },
    {
      id: "event:92",
      scene: {
        title: "遗言",
        body: speechSceneDialogue(speechScript, "event:92"),
        bodySource: "event",
        bodyLayout: "structured",
      },
      speech: speechSceneCues(speechScript, "event:92"),
      camera: [
        {
          frame: 0,
          target: "table",
        },
      ],
      layers: [],
    },
    {
      id: "event:93",
      scene: {
        title: "阶段交替",
        body: "第2天夜晚，天黑请闭眼",
        bodySource: "event",
        bodyLayout: "structured",
      },
      speech: speechSceneCues(speechScript, "event:93"),
      camera: [
        {
          frame: 0,
          target: "table",
        },
      ],
      layers: [],
    },
    {
      id: "event:95",
      scene: {
        title: "狼人交流",
        body: speechSceneDialogue(speechScript, "event:95"),
        bodySource: "event",
        bodyLayout: "structured",
      },
      speech: speechSceneCues(speechScript, "event:95"),
      camera: [
        {
          frame: 0,
          target: "table",
        },
      ],
      layers: [],
    },
    {
      id: "event:96",
      scene: {
        title: "狼人交流",
        body: speechSceneDialogue(speechScript, "event:96"),
        bodySource: "event",
        bodyLayout: "structured",
      },
      speech: speechSceneCues(speechScript, "event:96"),
      camera: [
        {
          frame: 0,
          target: "table",
        },
      ],
      layers: [],
    },
    {
      id: "event:97",
      scene: {
        title: "狼人交流",
        body: speechSceneDialogue(speechScript, "event:97"),
        bodySource: "event",
        bodyLayout: "structured",
      },
      speech: speechSceneCues(speechScript, "event:97"),
      camera: [
        {
          frame: 0,
          target: "table",
        },
      ],
      layers: [],
    },
    {
      id: "event:98",
      scene: {
        title: "狼人交流",
        body: speechSceneDialogue(speechScript, "event:98"),
        bodySource: "event",
        bodyLayout: "structured",
      },
      speech: speechSceneCues(speechScript, "event:98"),
      camera: [
        {
          frame: 0,
          target: "table",
        },
      ],
      layers: [],
    },
    {
      id: "event:99",
      scene: {
        title: "狼人交流",
        body: speechSceneDialogue(speechScript, "event:99"),
        bodySource: "event",
        bodyLayout: "structured",
      },
      speech: speechSceneCues(speechScript, "event:99"),
      camera: [
        {
          frame: 0,
          target: "table",
        },
      ],
      layers: [],
    },
    {
      id: "event:100",
      scene: {
        title: "狼人交流",
        body: speechSceneDialogue(speechScript, "event:100"),
        bodySource: "event",
        bodyLayout: "structured",
      },
      speech: speechSceneCues(speechScript, "event:100"),
      camera: [
        {
          frame: 0,
          target: "table",
        },
      ],
      layers: [],
    },
    {
      id: "event:101",
      scene: {
        title: "守卫行动",
        body: "9号守护5号",
        bodySource: "event",
        bodyLayout: "structured",
      },
      speech: speechSceneCues(speechScript, "event:101"),
      camera: [
        {
          frame: 0,
          target: "table",
        },
      ],
      layers: [],
    },
    {
      id: "fact:7",
      scene: {
        title: "狼刀确认",
        body: "本次狼刀目标：4号。",
        bodySource: "event",
        bodyLayout: "structured",
      },
      speech: speechSceneCues(speechScript, "fact:7"),
      camera: [
        {
          frame: 0,
          target: "table",
        },
      ],
      layers: [],
    },
    {
      id: "event:105",
      scene: {
        title: "女巫行动",
        body: "4号女巫未使用药剂",
        bodySource: "event",
        bodyLayout: "structured",
      },
      speech: speechSceneCues(speechScript, "event:105"),
      camera: [
        {
          frame: 0,
          target: "table",
        },
      ],
      layers: [],
    },
    {
      id: "event:106",
      scene: {
        title: "预言家行动",
        body: "5号查验4号：好人",
        bodySource: "event",
        bodyLayout: "structured",
      },
      speech: speechSceneCues(speechScript, "event:106"),
      camera: [
        {
          frame: 0,
          target: "table",
        },
      ],
      layers: [],
    },
    {
      id: "event:107",
      scene: {
        title: "阶段交替",
        body: "第2天白天，天亮了",
        bodySource: "event",
        bodyLayout: "structured",
      },
      speech: speechSceneCues(speechScript, "event:107"),
      camera: [
        {
          frame: 0,
          target: "table",
        },
      ],
      layers: [],
    },
    {
      id: "event:108",
      scene: {
        title: "夜晚结算",
        body: "昨夜死亡：4号",
        bodySource: "event",
        bodyLayout: "structured",
      },
      speech: speechSceneCues(speechScript, "event:108"),
      camera: [
        {
          frame: 0,
          target: "table",
        },
      ],
      layers: [],
    },
    {
      id: "event:109",
      scene: {
        title: "警长定序",
        body: "5号选择顺时针（警左）发言",
        bodySource: "event",
        bodyLayout: "structured",
      },
      speech: speechSceneCues(speechScript, "event:109"),
      camera: [
        {
          frame: 0,
          target: "table",
        },
      ],
      layers: [],
    },
    {
      id: "event:110",
      scene: {
        title: "白天发言",
        body: speechSceneDialogue(speechScript, "event:110"),
        bodySource: "event",
        bodyLayout: "structured",
      },
      speech: speechSceneCues(speechScript, "event:110"),
      camera: [
        {
          frame: 0,
          target: "table",
        },
      ],
      layers: [],
    },
    {
      id: "event:111",
      scene: {
        title: "白天发言",
        body: speechSceneDialogue(speechScript, "event:111"),
        bodySource: "event",
        bodyLayout: "structured",
      },
      speech: speechSceneCues(speechScript, "event:111"),
      camera: [
        {
          frame: 0,
          target: "table",
        },
      ],
      layers: [],
    },
    {
      id: "event:112",
      scene: {
        title: "白天发言",
        body: speechSceneDialogue(speechScript, "event:112"),
        bodySource: "event",
        bodyLayout: "structured",
      },
      speech: speechSceneCues(speechScript, "event:112"),
      camera: [
        {
          frame: 0,
          target: "table",
        },
      ],
      layers: [],
    },
    {
      id: "event:113",
      scene: {
        title: "白天发言",
        body: speechSceneDialogue(speechScript, "event:113"),
        bodySource: "event",
        bodyLayout: "structured",
      },
      speech: speechSceneCues(speechScript, "event:113"),
      camera: [
        {
          frame: 0,
          target: "table",
        },
      ],
      layers: [],
    },
    {
      id: "event:114",
      scene: {
        title: "白天发言",
        body: speechSceneDialogue(speechScript, "event:114"),
        bodySource: "event",
        bodyLayout: "structured",
      },
      speech: speechSceneCues(speechScript, "event:114"),
      camera: [
        {
          frame: 0,
          target: "table",
        },
      ],
      layers: [],
    },
    {
      id: "event:115",
      scene: {
        title: "白天发言",
        body: speechSceneDialogue(speechScript, "event:115"),
        bodySource: "event",
        bodyLayout: "structured",
      },
      speech: speechSceneCues(speechScript, "event:115"),
      camera: [
        {
          frame: 0,
          target: "table",
        },
      ],
      layers: [],
    },
    {
      id: "event:116",
      scene: {
        title: "白天发言",
        body: speechSceneDialogue(speechScript, "event:116"),
        bodySource: "event",
        bodyLayout: "structured",
      },
      speech: speechSceneCues(speechScript, "event:116"),
      camera: [
        {
          frame: 0,
          target: "table",
        },
      ],
      layers: [],
    },
    {
      id: "event:117",
      scene: {
        title: "白天发言",
        body: speechSceneDialogue(speechScript, "event:117"),
        bodySource: "event",
        bodyLayout: "structured",
      },
      speech: speechSceneCues(speechScript, "event:117"),
      camera: [
        {
          frame: 0,
          target: "table",
        },
      ],
      layers: [],
    },
    {
      id: "event:118",
      scene: {
        title: "白天发言",
        body: speechSceneDialogue(speechScript, "event:118"),
        bodySource: "event",
        bodyLayout: "structured",
      },
      speech: speechSceneCues(speechScript, "event:118"),
      camera: [
        {
          frame: 0,
          target: "table",
        },
      ],
      layers: [],
    },
    {
      id: "event:119",
      scene: {
        title: "白天发言",
        body: speechSceneDialogue(speechScript, "event:119"),
        bodySource: "event",
        bodyLayout: "structured",
      },
      speech: speechSceneCues(speechScript, "event:119"),
      camera: [
        {
          frame: 0,
          target: "table",
        },
      ],
      layers: [],
    },
    {
      id: "event:131",
      scene: {
        title: "放逐投票",
        body: "本轮票型已汇总，详情见票型图。",
        bodySource: "event",
        bodyLayout: "structured",
      },
      speech: speechSceneCues(speechScript, "event:131"),
      camera: [
        {
          frame: 0,
          target: "table",
        },
      ],
      layers: [],
    },
    {
      id: "fact:9",
      scene: {
        title: "死亡确认",
        body: "10号已死亡。",
        bodySource: "event",
        bodyLayout: "structured",
      },
      speech: speechSceneCues(speechScript, "fact:9"),
      camera: [
        {
          frame: 0,
          target: "table",
        },
      ],
      layers: [],
    },
    {
      id: "event:134",
      scene: {
        title: "遗言",
        body: speechSceneDialogue(speechScript, "event:134"),
        bodySource: "event",
        bodyLayout: "structured",
      },
      speech: speechSceneCues(speechScript, "event:134"),
      camera: [
        {
          frame: 0,
          target: "table",
        },
      ],
      layers: [],
    },
    {
      id: "event:135",
      scene: {
        title: "阶段交替",
        body: "第3天夜晚，天黑请闭眼",
        bodySource: "event",
        bodyLayout: "structured",
      },
      speech: speechSceneCues(speechScript, "event:135"),
      camera: [
        {
          frame: 0,
          target: "table",
        },
      ],
      layers: [],
    },
    {
      id: "event:137",
      scene: {
        title: "狼人交流",
        body: speechSceneDialogue(speechScript, "event:137"),
        bodySource: "event",
        bodyLayout: "structured",
      },
      speech: speechSceneCues(speechScript, "event:137"),
      camera: [
        {
          frame: 0,
          target: "table",
        },
      ],
      layers: [],
    },
    {
      id: "event:138",
      scene: {
        title: "狼人交流",
        body: speechSceneDialogue(speechScript, "event:138"),
        bodySource: "event",
        bodyLayout: "structured",
      },
      speech: speechSceneCues(speechScript, "event:138"),
      camera: [
        {
          frame: 0,
          target: "table",
        },
      ],
      layers: [],
    },
    {
      id: "event:139",
      scene: {
        title: "狼人交流",
        body: speechSceneDialogue(speechScript, "event:139"),
        bodySource: "event",
        bodyLayout: "structured",
      },
      speech: speechSceneCues(speechScript, "event:139"),
      camera: [
        {
          frame: 0,
          target: "table",
        },
      ],
      layers: [],
    },
    {
      id: "event:140",
      scene: {
        title: "狼人交流",
        body: speechSceneDialogue(speechScript, "event:140"),
        bodySource: "event",
        bodyLayout: "structured",
      },
      speech: speechSceneCues(speechScript, "event:140"),
      camera: [
        {
          frame: 0,
          target: "table",
        },
      ],
      layers: [],
    },
    {
      id: "event:141",
      scene: {
        title: "守卫行动",
        body: "9号守护11号",
        bodySource: "event",
        bodyLayout: "structured",
      },
      speech: speechSceneCues(speechScript, "event:141"),
      camera: [
        {
          frame: 0,
          target: "table",
        },
      ],
      layers: [],
    },
    {
      id: "fact:10",
      scene: {
        title: "狼刀确认",
        body: "本次狼刀目标：5号。",
        bodySource: "event",
        bodyLayout: "structured",
      },
      speech: speechSceneCues(speechScript, "fact:10"),
      camera: [
        {
          frame: 0,
          target: "table",
        },
      ],
      layers: [],
    },
    {
      id: "event:144",
      scene: {
        title: "预言家行动",
        body: "5号查验11号：狼人",
        bodySource: "event",
        bodyLayout: "structured",
      },
      speech: speechSceneCues(speechScript, "event:144"),
      camera: [
        {
          frame: 0,
          target: "table",
        },
      ],
      layers: [],
    },
    {
      id: "event:145",
      scene: {
        title: "阶段交替",
        body: "第3天白天，天亮了",
        bodySource: "event",
        bodyLayout: "structured",
      },
      speech: speechSceneCues(speechScript, "event:145"),
      camera: [
        {
          frame: 0,
          target: "table",
        },
      ],
      layers: [],
    },
    {
      id: "event:146",
      scene: {
        title: "夜晚结算",
        body: "昨夜死亡：5号",
        bodySource: "event",
        bodyLayout: "structured",
      },
      speech: speechSceneCues(speechScript, "event:146"),
      camera: [
        {
          frame: 0,
          target: "table",
        },
      ],
      layers: [],
    },
    {
      id: "event:147",
      scene: {
        title: "警徽移交",
        body: "5号将警徽移交给1号",
        bodySource: "event",
        bodyLayout: "structured",
      },
      speech: speechSceneCues(speechScript, "event:147"),
      camera: [
        {
          frame: 0,
          target: "table",
        },
      ],
      layers: [],
    },
    {
      id: "event:148",
      scene: {
        title: "警长定序",
        body: "1号选择逆时针（警右）发言",
        bodySource: "event",
        bodyLayout: "structured",
      },
      speech: speechSceneCues(speechScript, "event:148"),
      camera: [
        {
          frame: 0,
          target: "table",
        },
      ],
      layers: [],
    },
    {
      id: "event:149",
      scene: {
        title: "白天发言",
        body: speechSceneDialogue(speechScript, "event:149"),
        bodySource: "event",
        bodyLayout: "structured",
      },
      speech: speechSceneCues(speechScript, "event:149"),
      camera: [
        {
          frame: 0,
          target: "table",
        },
      ],
      layers: [],
    },
    {
      id: "event:150",
      scene: {
        title: "白天发言",
        body: speechSceneDialogue(speechScript, "event:150"),
        bodySource: "event",
        bodyLayout: "structured",
      },
      speech: speechSceneCues(speechScript, "event:150"),
      camera: [
        {
          frame: 0,
          target: "table",
        },
      ],
      layers: [],
    },
    {
      id: "event:151",
      scene: {
        title: "白天发言",
        body: speechSceneDialogue(speechScript, "event:151"),
        bodySource: "event",
        bodyLayout: "structured",
      },
      speech: speechSceneCues(speechScript, "event:151"),
      camera: [
        {
          frame: 0,
          target: "table",
        },
      ],
      layers: [],
    },
    {
      id: "event:152",
      scene: {
        title: "白天发言",
        body: speechSceneDialogue(speechScript, "event:152"),
        bodySource: "event",
        bodyLayout: "structured",
      },
      speech: speechSceneCues(speechScript, "event:152"),
      camera: [
        {
          frame: 0,
          target: "table",
        },
      ],
      layers: [],
    },
    {
      id: "event:153",
      scene: {
        title: "白天发言",
        body: speechSceneDialogue(speechScript, "event:153"),
        bodySource: "event",
        bodyLayout: "structured",
      },
      speech: speechSceneCues(speechScript, "event:153"),
      camera: [
        {
          frame: 0,
          target: "table",
        },
      ],
      layers: [],
    },
    {
      id: "event:154",
      scene: {
        title: "白天发言",
        body: speechSceneDialogue(speechScript, "event:154"),
        bodySource: "event",
        bodyLayout: "structured",
      },
      speech: speechSceneCues(speechScript, "event:154"),
      camera: [
        {
          frame: 0,
          target: "table",
        },
      ],
      layers: [],
    },
    {
      id: "event:155",
      scene: {
        title: "白天发言",
        body: speechSceneDialogue(speechScript, "event:155"),
        bodySource: "event",
        bodyLayout: "structured",
      },
      speech: speechSceneCues(speechScript, "event:155"),
      camera: [
        {
          frame: 0,
          target: "table",
        },
      ],
      layers: [],
    },
    {
      id: "event:156",
      scene: {
        title: "白天发言",
        body: speechSceneDialogue(speechScript, "event:156"),
        bodySource: "event",
        bodyLayout: "structured",
      },
      speech: speechSceneCues(speechScript, "event:156"),
      camera: [
        {
          frame: 0,
          target: "table",
        },
      ],
      layers: [],
    },
    {
      id: "event:157",
      scene: {
        title: "骑士决斗",
        body: "8号骑士决斗1号，目标非狼存活，骑士出局",
        bodySource: "event",
        bodyLayout: "structured",
      },
      speech: speechSceneCues(speechScript, "event:157"),
      camera: [
        {
          frame: 0,
          target: "table",
        },
      ],
      layers: [],
    },
    {
      id: "event:159",
      scene: {
        title: "遗言",
        body: speechSceneDialogue(speechScript, "event:159"),
        bodySource: "event",
        bodyLayout: "structured",
      },
      speech: speechSceneCues(speechScript, "event:159"),
      camera: [
        {
          frame: 0,
          target: "table",
        },
      ],
      layers: [],
    },
    {
      id: "event:168",
      scene: {
        title: "放逐投票",
        body: "本轮票型已汇总，详情见票型图。",
        bodySource: "event",
        bodyLayout: "structured",
      },
      speech: speechSceneCues(speechScript, "event:168"),
      camera: [
        {
          frame: 0,
          target: "table",
        },
      ],
      layers: [],
    },
    {
      id: "fact:13",
      scene: {
        title: "死亡确认",
        body: "6号已死亡。",
        bodySource: "event",
        bodyLayout: "structured",
      },
      speech: speechSceneCues(speechScript, "fact:13"),
      camera: [
        {
          frame: 0,
          target: "table",
        },
      ],
      layers: [],
    },
    {
      id: "event:171",
      scene: {
        title: "遗言",
        body: speechSceneDialogue(speechScript, "event:171"),
        bodySource: "event",
        bodyLayout: "structured",
      },
      speech: speechSceneCues(speechScript, "event:171"),
      camera: [
        {
          frame: 0,
          target: "table",
        },
      ],
      layers: [],
    },
    {
      id: "event:172",
      scene: {
        title: "阶段交替",
        body: "第4天夜晚，天黑请闭眼",
        bodySource: "event",
        bodyLayout: "structured",
      },
      speech: speechSceneCues(speechScript, "event:172"),
      camera: [
        {
          frame: 0,
          target: "table",
        },
      ],
      layers: [],
    },
    {
      id: "event:174",
      scene: {
        title: "狼人交流",
        body: speechSceneDialogue(speechScript, "event:174"),
        bodySource: "event",
        bodyLayout: "structured",
      },
      speech: speechSceneCues(speechScript, "event:174"),
      camera: [
        {
          frame: 0,
          target: "table",
        },
      ],
      layers: [],
    },
    {
      id: "event:175",
      scene: {
        title: "狼人交流",
        body: speechSceneDialogue(speechScript, "event:175"),
        bodySource: "event",
        bodyLayout: "structured",
      },
      speech: speechSceneCues(speechScript, "event:175"),
      camera: [
        {
          frame: 0,
          target: "table",
        },
      ],
      layers: [],
    },
    {
      id: "event:176",
      scene: {
        title: "狼人交流",
        body: speechSceneDialogue(speechScript, "event:176"),
        bodySource: "event",
        bodyLayout: "structured",
      },
      speech: speechSceneCues(speechScript, "event:176"),
      camera: [
        {
          frame: 0,
          target: "table",
        },
      ],
      layers: [],
    },
    {
      id: "event:177",
      scene: {
        title: "守卫行动",
        body: "9号守护1号",
        bodySource: "event",
        bodyLayout: "structured",
      },
      speech: speechSceneCues(speechScript, "event:177"),
      camera: [
        {
          frame: 0,
          target: "table",
        },
      ],
      layers: [],
    },
    {
      id: "fact:14",
      scene: {
        title: "狼刀确认",
        body: "本次狼刀目标：9号。",
        bodySource: "event",
        bodyLayout: "structured",
      },
      speech: speechSceneCues(speechScript, "fact:14"),
      camera: [
        {
          frame: 0,
          target: "table",
        },
      ],
      layers: [],
    },
    {
      id: "event:180",
      scene: {
        title: "阶段交替",
        body: "第4天白天，天亮了",
        bodySource: "event",
        bodyLayout: "structured",
      },
      speech: speechSceneCues(speechScript, "event:180"),
      camera: [
        {
          frame: 0,
          target: "table",
        },
      ],
      layers: [],
    },
    {
      id: "event:181",
      scene: {
        title: "夜晚结算",
        body: "昨夜死亡：9号",
        bodySource: "event",
        bodyLayout: "structured",
      },
      speech: speechSceneCues(speechScript, "event:181"),
      camera: [
        {
          frame: 0,
          target: "table",
        },
      ],
      layers: [],
    },
    {
      id: "event:183",
      scene: {
        title: "终局",
        body: "对局结束：狼人阵营胜利（屠边条件达成） · 获胜玩家：3号、7号、10号、11号",
        bodySource: "event",
        bodyLayout: "structured",
      },
      speech: speechSceneCues(speechScript, "event:183"),
      camera: [
        {
          frame: 0,
          target: "table",
        },
      ],
      layers: [],
    },
  ],
};
