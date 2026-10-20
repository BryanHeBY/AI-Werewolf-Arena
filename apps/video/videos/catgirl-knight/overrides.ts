/** 负责保存本局完整画面底稿。输入为原生前端脚本副本，输出可直接修改的片头、镜头和说明；口播与玩家全文引用speech.jsonl的稳定ID，不重复维护。 */
import type { VideoScript } from "@ai-werewolf-arena/game-media/video/plan";
import { speechSceneCues, speechSceneDialogue } from "@ai-werewolf-arena/game-media/speech-script";
import { speechScript } from "./dialogue";
export const script: VideoScript = {
  source: {
    sessionId: "session_1792391429963_4bygw6",
    fingerprint: "fnv1a64:bcf5db723cdcca88",
  },
  layout: "broadcast-v1",
  pacing: "narration",
  theme: {
    id: "gothic-v1",
  },
  fps: 30,
  width: 1920,
  height: 1080,
  subtitles: {
    lingerMs: 400,
  },
  intro: [
    {
      id: "title",
      durationFrames: 270,
      readingClock: "flow",
      scene: {
        kind: "phase",
        title: "12 个 GPT 猫娘玩狼人杀",
        body: "骑士亮剑直指警长，狼美人一吻牵生死",
        speaker: "narrator",
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
        bodySource: "script",
        bodyLayout: "text",
      },
      speech: speechSceneCues(speechScript, "intro:title"),
      emphasis: [
        {
          text: "狼美人",
          color: "#ff8e9e",
        },
        {
          text: "骑士",
          color: "#9cdbb9",
        },
        {
          text: "警长",
          color: "#f3ce7a",
        },
      ],
    },
    {
      id: "rules",
      durationFrames: 900,
      readingClock: "flow",
      scene: {
        kind: "phase",
        title: "对局信息 · 狼美人骑士",
        body: "阵容：3 狼人＋狼美人，4 平民，预言家、女巫、守卫、骑士。\n胜负：好人清狼；狼人屠神或屠民。\n\n狼美人：每夜魅惑一人，不可连续同一目标；放逐或毒杀会牵连，骑士决斗不触发。\n骑士：一次决斗，命中狼人直接入夜，误中好人自己出局。\n守卫：不能连守同一人，同守同救抵消。\n女巫：解药、毒药各一瓶，不能自救。",
        notes: {
          title: "模型与人格配置",
          body: "模型：gpt-6.1-sol × 12　·　独立会话，各自可见信息。\n提示词节选：「本局你是一位可爱的猫娘玩家。」\n「每一句完整的自然语言句子都必须以“喵”收尾。」\n软萌俏皮、认真争胜；发言、投票与技能由 Agent 自主决定。",
        },
        speaker: "narrator",
        cues: {
          establish: 0,
          travel: 0,
          impact: 0,
          settled: 0,
        },
        bodySource: "script",
        bodyLayout: "text",
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
          text: "预言家、女巫、守卫、骑士",
          color: "#9cdbb9",
        },
        {
          text: "好人清狼",
          color: "#9cdbb9",
        },
        {
          text: "狼人屠神或屠民",
          color: "#ff8e9e",
        },
        {
          text: "狼美人：",
          color: "#ff8e9e",
        },
        {
          text: "骑士决斗不触发",
          color: "#f3ce7a",
        },
        {
          text: "骑士：",
          color: "#9cdbb9",
        },
        {
          text: "守卫：",
          color: "#91c8e8",
        },
        {
          text: "同守同救抵消",
          color: "#f3ce7a",
        },
        {
          text: "女巫：",
          color: "#c8b3f2",
        },
        {
          text: "不能自救",
          color: "#f3ce7a",
        },
      ],
    },
  ],
  edits: [
    {
      anchor: {
        seq: 9,
        type: "wolf_kill_vote_cast",
      },
      skip: true,
    },
    {
      anchor: {
        seq: 10,
        type: "wolf_kill_vote_cast",
      },
      skip: true,
    },
    {
      anchor: {
        seq: 11,
        type: "wolf_kill_vote_cast",
      },
      skip: true,
    },
    {
      anchor: {
        seq: 12,
        type: "wolf_kill_vote_cast",
      },
      skip: true,
    },
    {
      anchor: {
        seq: 72,
        type: "wolf_kill_vote_cast",
      },
      skip: true,
    },
    {
      anchor: {
        seq: 73,
        type: "wolf_kill_vote_cast",
      },
      skip: true,
    },
    {
      anchor: {
        seq: 74,
        type: "wolf_kill_vote_cast",
      },
      skip: true,
    },
    {
      anchor: {
        seq: 111,
        type: "wolf_kill_vote_cast",
      },
      skip: true,
    },
    {
      anchor: {
        seq: 112,
        type: "wolf_kill_vote_cast",
      },
      skip: true,
    },
    {
      anchor: {
        seq: 145,
        type: "wolf_kill_vote_cast",
      },
      skip: true,
    },
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
        seq: 37,
        type: "sheriff_candidates_finalized",
      },
      skip: true,
    },
    {
      anchor: {
        seq: 67,
        type: "wolf_tactical_order",
      },
      skip: true,
    },
    {
      anchor: {
        seq: 91,
        type: "phase_changed",
      },
      skip: true,
    },
    {
      anchor: {
        seq: 104,
        type: "last_words_granted",
      },
      skip: true,
    },
    {
      anchor: {
        seq: 107,
        type: "wolf_tactical_order",
      },
      skip: true,
    },
    {
      anchor: {
        seq: 127,
        type: "phase_changed",
      },
      skip: true,
    },
    {
      anchor: {
        seq: 138,
        type: "last_words_granted",
      },
      skip: true,
    },
    {
      anchor: {
        seq: 142,
        type: "wolf_tactical_order",
      },
      skip: true,
    },
    {
      anchor: {
        seq: 150,
        type: "additional_deaths",
      },
      skip: true,
    },
    {
      anchor: {
        seq: 151,
        type: "charm_death",
      },
      skip: true,
    },
    {
      anchor: {
        seq: 153,
        type: "phase_changed",
      },
      skip: true,
    },
    {
      anchor: {
        seq: 64,
        type: "knight_duel",
      },
      lifeFacts: [
        {
          seq: 5,
          kind: "life_committed",
        },
      ],
    },
    {
      anchor: {
        seq: 149,
        type: "night_resolved",
      },
      lifeFacts: [
        {
          seq: 17,
          kind: "life_committed",
        },
        {
          seq: 18,
          kind: "life_committed",
        },
      ],
    },
  ],
  factEdits: [],
  shotEdits: [
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
        title: "守卫行动",
        body: "9号守卫选择空守",
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
      id: "fact:2",
      scene: {
        title: "狼刀确认",
        body: "本次狼刀目标：9号。",
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
      emphasis: [
        {
          text: "9号",
          color: "#ff8e9e",
        },
      ],
    },
    {
      id: "event:13",
      scene: {
        title: "魅惑选择",
        body: "8号狼美人本夜魅惑目标：11（第1夜）",
        bodySource: "event",
        bodyLayout: "structured",
      },
      speech: speechSceneCues(speechScript, "event:13"),
      camera: [
        {
          frame: 0,
          target: "table",
        },
      ],
      layers: [],
    },
    {
      id: "event:14",
      scene: {
        title: "女巫行动",
        body: "2号对9号使用解药",
        bodySource: "event",
        bodyLayout: "structured",
      },
      speech: speechSceneCues(speechScript, "event:14"),
      camera: [
        {
          frame: 0,
          target: "table",
        },
      ],
      layers: [],
    },
    {
      id: "event:15",
      scene: {
        title: "预言家行动",
        body: "4号查验9号：好人",
        bodySource: "event",
        bodyLayout: "structured",
      },
      speech: speechSceneCues(speechScript, "event:15"),
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
        body: "9号的狼刀伤害被解药阻止。",
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
      id: "event:16",
      scene: {
        title: "阶段交替",
        body: "第1天白天，天亮了",
        bodySource: "event",
        bodyLayout: "structured",
      },
      speech: speechSceneCues(speechScript, "event:16"),
      camera: [
        {
          frame: 0,
          target: "table",
        },
      ],
      layers: [],
    },
    {
      id: "event:29",
      scene: {
        title: "上警结果",
        body: "上警玩家：1号、4号、5号、11号",
        bodySource: "event",
        bodyLayout: "structured",
      },
      speech: speechSceneCues(speechScript, "event:29"),
      camera: [
        {
          frame: 0,
          target: "table",
        },
      ],
      layers: [],
    },
    {
      id: "event:30",
      scene: {
        title: "白天发言",
        body: speechSceneDialogue(speechScript, "event:30"),
        bodySource: "event",
        bodyLayout: "structured",
      },
      speech: speechSceneCues(speechScript, "event:30"),
      camera: [
        {
          frame: 0,
          target: "table",
        },
      ],
      layers: [],
    },
    {
      id: "event:31",
      scene: {
        title: "白天发言",
        body: speechSceneDialogue(speechScript, "event:31"),
        bodySource: "event",
        bodyLayout: "structured",
      },
      speech: speechSceneCues(speechScript, "event:31"),
      camera: [
        {
          frame: 0,
          target: "table",
        },
      ],
      layers: [],
    },
    {
      id: "event:32",
      scene: {
        title: "白天发言",
        body: speechSceneDialogue(speechScript, "event:32"),
        bodySource: "event",
        bodyLayout: "structured",
      },
      speech: speechSceneCues(speechScript, "event:32"),
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
        title: "白天发言",
        body: speechSceneDialogue(speechScript, "event:33"),
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
      id: "event:36",
      scene: {
        title: "退水结果",
        body: "退水玩家：1号、11号",
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
      id: "event:48",
      scene: {
        title: "警长票型",
        body: "本轮票型已汇总，详情见票型图。",
        bodySource: "event",
        bodyLayout: "structured",
      },
      speech: speechSceneCues(speechScript, "event:48"),
      camera: [
        {
          frame: 0,
          target: "table",
        },
      ],
      layers: [],
    },
    {
      id: "event:50",
      scene: {
        title: "夜晚结算",
        body: "昨夜是平安夜",
        bodySource: "event",
        bodyLayout: "structured",
      },
      speech: speechSceneCues(speechScript, "event:50"),
      camera: [
        {
          frame: 0,
          target: "table",
        },
      ],
      layers: [],
    },
    {
      id: "event:51",
      scene: {
        title: "警长定序",
        body: "5号选择逆时针（警右）发言",
        bodySource: "event",
        bodyLayout: "structured",
      },
      speech: speechSceneCues(speechScript, "event:51"),
      camera: [
        {
          frame: 0,
          target: "table",
        },
      ],
      layers: [],
    },
    {
      id: "event:52",
      scene: {
        title: "白天发言",
        body: speechSceneDialogue(speechScript, "event:52"),
        bodySource: "event",
        bodyLayout: "structured",
      },
      speech: speechSceneCues(speechScript, "event:52"),
      camera: [
        {
          frame: 0,
          target: "table",
        },
      ],
      layers: [],
    },
    {
      id: "event:53",
      scene: {
        title: "白天发言",
        body: speechSceneDialogue(speechScript, "event:53"),
        bodySource: "event",
        bodyLayout: "structured",
      },
      speech: speechSceneCues(speechScript, "event:53"),
      camera: [
        {
          frame: 0,
          target: "table",
        },
      ],
      layers: [],
    },
    {
      id: "event:54",
      scene: {
        title: "白天发言",
        body: speechSceneDialogue(speechScript, "event:54"),
        bodySource: "event",
        bodyLayout: "structured",
      },
      speech: speechSceneCues(speechScript, "event:54"),
      camera: [
        {
          frame: 0,
          target: "table",
        },
      ],
      layers: [],
    },
    {
      id: "event:55",
      scene: {
        title: "白天发言",
        body: speechSceneDialogue(speechScript, "event:55"),
        bodySource: "event",
        bodyLayout: "structured",
      },
      speech: speechSceneCues(speechScript, "event:55"),
      camera: [
        {
          frame: 0,
          target: "table",
        },
      ],
      layers: [],
    },
    {
      id: "event:56",
      scene: {
        title: "白天发言",
        body: speechSceneDialogue(speechScript, "event:56"),
        bodySource: "event",
        bodyLayout: "structured",
      },
      speech: speechSceneCues(speechScript, "event:56"),
      camera: [
        {
          frame: 0,
          target: "table",
        },
      ],
      layers: [],
    },
    {
      id: "event:57",
      scene: {
        title: "白天发言",
        body: speechSceneDialogue(speechScript, "event:57"),
        bodySource: "event",
        bodyLayout: "structured",
      },
      speech: speechSceneCues(speechScript, "event:57"),
      camera: [
        {
          frame: 0,
          target: "table",
        },
      ],
      layers: [],
    },
    {
      id: "event:58",
      scene: {
        title: "白天发言",
        body: speechSceneDialogue(speechScript, "event:58"),
        bodySource: "event",
        bodyLayout: "structured",
      },
      speech: speechSceneCues(speechScript, "event:58"),
      camera: [
        {
          frame: 0,
          target: "table",
        },
      ],
      layers: [],
    },
    {
      id: "event:59",
      scene: {
        title: "白天发言",
        body: speechSceneDialogue(speechScript, "event:59"),
        bodySource: "event",
        bodyLayout: "structured",
      },
      speech: speechSceneCues(speechScript, "event:59"),
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
        title: "白天发言",
        body: speechSceneDialogue(speechScript, "event:60"),
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
      id: "event:61",
      scene: {
        title: "白天发言",
        body: speechSceneDialogue(speechScript, "event:61"),
        bodySource: "event",
        bodyLayout: "structured",
      },
      speech: speechSceneCues(speechScript, "event:61"),
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
        title: "白天发言",
        body: speechSceneDialogue(speechScript, "event:62"),
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
        title: "白天发言",
        body: speechSceneDialogue(speechScript, "event:63"),
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
        title: "骑士决斗",
        body: "11号骑士决斗5号，目标为狼并出局",
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
        title: "警徽移交",
        body: "5号将警徽移交给1号",
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
        title: "阶段交替",
        body: "第2天夜晚，天黑请闭眼",
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
      id: "event:68",
      scene: {
        title: "狼人交流",
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
        title: "狼人交流",
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
        title: "狼人交流",
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
        title: "守卫行动",
        body: "9号守护4号",
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
      id: "fact:7",
      scene: {
        title: "狼刀确认",
        body: "本次狼刀目标：11号。",
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
      emphasis: [
        {
          text: "11号",
          color: "#ff8e9e",
        },
      ],
    },
    {
      id: "event:75",
      scene: {
        title: "魅惑选择",
        body: "8号狼美人本夜魅惑目标：4（第2夜）",
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
      id: "event:76",
      scene: {
        title: "女巫行动",
        body: "2号女巫未使用药剂",
        bodySource: "event",
        bodyLayout: "structured",
      },
      speech: speechSceneCues(speechScript, "event:76"),
      camera: [
        {
          frame: 0,
          target: "table",
        },
      ],
      layers: [],
    },
    {
      id: "event:77",
      scene: {
        title: "预言家行动",
        body: "4号查验10号：好人",
        bodySource: "event",
        bodyLayout: "structured",
      },
      speech: speechSceneCues(speechScript, "event:77"),
      camera: [
        {
          frame: 0,
          target: "table",
        },
      ],
      layers: [],
    },
    {
      id: "event:78",
      scene: {
        title: "阶段交替",
        body: "第2天白天，天亮了",
        bodySource: "event",
        bodyLayout: "structured",
      },
      speech: speechSceneCues(speechScript, "event:78"),
      camera: [
        {
          frame: 0,
          target: "table",
        },
      ],
      layers: [],
    },
    {
      id: "event:79",
      scene: {
        title: "夜晚结算",
        body: "昨夜死亡：11号",
        bodySource: "event",
        bodyLayout: "structured",
      },
      speech: speechSceneCues(speechScript, "event:79"),
      camera: [
        {
          frame: 0,
          target: "table",
        },
      ],
      layers: [],
    },
    {
      id: "event:80",
      scene: {
        title: "警长定序",
        body: "1号选择顺时针（警左）发言",
        bodySource: "event",
        bodyLayout: "structured",
      },
      speech: speechSceneCues(speechScript, "event:80"),
      camera: [
        {
          frame: 0,
          target: "table",
        },
      ],
      layers: [],
    },
    {
      id: "event:81",
      scene: {
        title: "白天发言",
        body: speechSceneDialogue(speechScript, "event:81"),
        bodySource: "event",
        bodyLayout: "structured",
      },
      speech: speechSceneCues(speechScript, "event:81"),
      camera: [
        {
          frame: 0,
          target: "table",
        },
      ],
      layers: [],
    },
    {
      id: "event:82",
      scene: {
        title: "白天发言",
        body: speechSceneDialogue(speechScript, "event:82"),
        bodySource: "event",
        bodyLayout: "structured",
      },
      speech: speechSceneCues(speechScript, "event:82"),
      camera: [
        {
          frame: 0,
          target: "table",
        },
      ],
      layers: [],
    },
    {
      id: "event:83",
      scene: {
        title: "白天发言",
        body: speechSceneDialogue(speechScript, "event:83"),
        bodySource: "event",
        bodyLayout: "structured",
      },
      speech: speechSceneCues(speechScript, "event:83"),
      camera: [
        {
          frame: 0,
          target: "table",
        },
      ],
      layers: [],
    },
    {
      id: "event:84",
      scene: {
        title: "白天发言",
        body: speechSceneDialogue(speechScript, "event:84"),
        bodySource: "event",
        bodyLayout: "structured",
      },
      speech: speechSceneCues(speechScript, "event:84"),
      camera: [
        {
          frame: 0,
          target: "table",
        },
      ],
      layers: [],
    },
    {
      id: "event:85",
      scene: {
        title: "白天发言",
        body: speechSceneDialogue(speechScript, "event:85"),
        bodySource: "event",
        bodyLayout: "structured",
      },
      speech: speechSceneCues(speechScript, "event:85"),
      camera: [
        {
          frame: 0,
          target: "table",
        },
      ],
      layers: [],
    },
    {
      id: "event:86",
      scene: {
        title: "白天发言",
        body: speechSceneDialogue(speechScript, "event:86"),
        bodySource: "event",
        bodyLayout: "structured",
      },
      speech: speechSceneCues(speechScript, "event:86"),
      camera: [
        {
          frame: 0,
          target: "table",
        },
      ],
      layers: [],
    },
    {
      id: "event:87",
      scene: {
        title: "白天发言",
        body: speechSceneDialogue(speechScript, "event:87"),
        bodySource: "event",
        bodyLayout: "structured",
      },
      speech: speechSceneCues(speechScript, "event:87"),
      camera: [
        {
          frame: 0,
          target: "table",
        },
      ],
      layers: [],
    },
    {
      id: "event:88",
      scene: {
        title: "白天发言",
        body: speechSceneDialogue(speechScript, "event:88"),
        bodySource: "event",
        bodyLayout: "structured",
      },
      speech: speechSceneCues(speechScript, "event:88"),
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
        title: "白天发言",
        body: speechSceneDialogue(speechScript, "event:89"),
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
      id: "event:90",
      scene: {
        title: "白天发言",
        body: speechSceneDialogue(speechScript, "event:90"),
        bodySource: "event",
        bodyLayout: "structured",
      },
      speech: speechSceneCues(speechScript, "event:90"),
      camera: [
        {
          frame: 0,
          target: "table",
        },
      ],
      layers: [],
    },
    {
      id: "event:102",
      scene: {
        title: "放逐投票",
        body: "本轮票型已汇总，详情见票型图。",
        bodySource: "event",
        bodyLayout: "structured",
      },
      speech: speechSceneCues(speechScript, "event:102"),
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
        body: "6号已死亡。",
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
      id: "event:105",
      scene: {
        title: "遗言",
        body: speechSceneDialogue(speechScript, "event:105"),
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
        title: "阶段交替",
        body: "第3天夜晚，天黑请闭眼",
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
      id: "event:108",
      scene: {
        title: "狼人交流",
        body: speechSceneDialogue(speechScript, "event:108"),
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
        title: "狼人交流",
        body: speechSceneDialogue(speechScript, "event:109"),
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
        title: "守卫行动",
        body: "9号守护9号",
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
      id: "fact:11",
      scene: {
        title: "狼刀确认",
        body: "本次狼刀目标：4号。",
        bodySource: "event",
        bodyLayout: "structured",
      },
      speech: speechSceneCues(speechScript, "fact:11"),
      camera: [
        {
          frame: 0,
          target: "table",
        },
      ],
      layers: [],
      emphasis: [
        {
          text: "4号",
          color: "#ff8e9e",
        },
      ],
    },
    {
      id: "event:113",
      scene: {
        title: "魅惑选择",
        body: "8号狼美人本夜魅惑目标：7（第3夜）",
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
        title: "女巫行动",
        body: "2号女巫未使用药剂",
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
        title: "预言家行动",
        body: "4号查验1号：狼人",
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
        title: "阶段交替",
        body: "第3天白天，天亮了",
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
        title: "夜晚结算",
        body: "昨夜死亡：4号",
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
        title: "警长定序",
        body: "1号选择顺时针（警左）发言",
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
      id: "event:120",
      scene: {
        title: "白天发言",
        body: speechSceneDialogue(speechScript, "event:120"),
        bodySource: "event",
        bodyLayout: "structured",
      },
      speech: speechSceneCues(speechScript, "event:120"),
      camera: [
        {
          frame: 0,
          target: "table",
        },
      ],
      layers: [],
    },
    {
      id: "event:121",
      scene: {
        title: "白天发言",
        body: speechSceneDialogue(speechScript, "event:121"),
        bodySource: "event",
        bodyLayout: "structured",
      },
      speech: speechSceneCues(speechScript, "event:121"),
      camera: [
        {
          frame: 0,
          target: "table",
        },
      ],
      layers: [],
    },
    {
      id: "event:122",
      scene: {
        title: "白天发言",
        body: speechSceneDialogue(speechScript, "event:122"),
        bodySource: "event",
        bodyLayout: "structured",
      },
      speech: speechSceneCues(speechScript, "event:122"),
      camera: [
        {
          frame: 0,
          target: "table",
        },
      ],
      layers: [],
    },
    {
      id: "event:123",
      scene: {
        title: "白天发言",
        body: speechSceneDialogue(speechScript, "event:123"),
        bodySource: "event",
        bodyLayout: "structured",
      },
      speech: speechSceneCues(speechScript, "event:123"),
      camera: [
        {
          frame: 0,
          target: "table",
        },
      ],
      layers: [],
    },
    {
      id: "event:124",
      scene: {
        title: "白天发言",
        body: speechSceneDialogue(speechScript, "event:124"),
        bodySource: "event",
        bodyLayout: "structured",
      },
      speech: speechSceneCues(speechScript, "event:124"),
      camera: [
        {
          frame: 0,
          target: "table",
        },
      ],
      layers: [],
    },
    {
      id: "event:125",
      scene: {
        title: "白天发言",
        body: speechSceneDialogue(speechScript, "event:125"),
        bodySource: "event",
        bodyLayout: "structured",
      },
      speech: speechSceneCues(speechScript, "event:125"),
      camera: [
        {
          frame: 0,
          target: "table",
        },
      ],
      layers: [],
    },
    {
      id: "event:126",
      scene: {
        title: "白天发言",
        body: speechSceneDialogue(speechScript, "event:126"),
        bodySource: "event",
        bodyLayout: "structured",
      },
      speech: speechSceneCues(speechScript, "event:126"),
      camera: [
        {
          frame: 0,
          target: "table",
        },
      ],
      layers: [],
    },
    {
      id: "event:136",
      scene: {
        title: "放逐投票",
        body: "本轮票型已汇总，详情见票型图。",
        bodySource: "event",
        bodyLayout: "structured",
      },
      speech: speechSceneCues(speechScript, "event:136"),
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
        body: "1号已死亡。",
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
      id: "event:139",
      scene: {
        title: "遗言",
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
        title: "警徽移交",
        body: "1号将警徽移交给2号",
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
        title: "阶段交替",
        body: "第4天夜晚，天黑请闭眼",
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
      id: "event:143",
      scene: {
        title: "狼人交流",
        body: speechSceneDialogue(speechScript, "event:143"),
        bodySource: "event",
        bodyLayout: "structured",
      },
      speech: speechSceneCues(speechScript, "event:143"),
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
        title: "守卫行动",
        body: "9号守护2号",
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
      id: "fact:15",
      scene: {
        title: "狼刀确认",
        body: "本次狼刀目标：7号。",
        bodySource: "event",
        bodyLayout: "structured",
      },
      speech: speechSceneCues(speechScript, "fact:15"),
      camera: [
        {
          frame: 0,
          target: "table",
        },
      ],
      layers: [],
      emphasis: [
        {
          text: "7号",
          color: "#ff8e9e",
        },
      ],
    },
    {
      id: "event:146",
      scene: {
        title: "魅惑选择",
        body: "8号狼美人本夜魅惑目标：2（第4夜）",
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
        title: "女巫行动",
        body: "2号对8号使用毒药",
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
        title: "阶段交替",
        body: "第4天白天，天亮了",
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
        title: "夜晚结算",
        body: "昨夜死亡：7号、8号",
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
      id: "fact:19",
      scene: {
        title: "狼美人牵连",
        body: "8号狼美人出局，2号被魅惑牵连死亡。",
        bodySource: "script",
        bodyLayout: "text",
      },
      speech: speechSceneCues(speechScript, "fact:19"),
      camera: [
        {
          frame: 0,
          target: "table",
        },
      ],
      layers: [],
      emphasis: [
        {
          text: "2号",
          color: "#ff8e9e",
        },
        {
          text: "牵连死亡",
          color: "#f3ce7a",
        },
      ],
    },
    {
      id: "event:152",
      scene: {
        title: "警徽移交",
        body: "2号将警徽移交给3号",
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
      id: "event:154",
      scene: {
        title: "终局",
        body: "对局结束：好人阵营胜利（狼人全部出局） · 获胜玩家：2号、3号、4号、7号、9号、10号、11号、12号",
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
  ],
};
