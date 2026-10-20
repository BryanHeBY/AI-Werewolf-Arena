/** 负责本局完整画面底稿。输入为原生前端脚本副本，输出可直接编辑的片头与全部镜头；口播和玩家全文引用speech.jsonl，不重复维护。 */
import type { VideoScript } from "@ai-werewolf-arena/game-media/video/plan";
import { speechSceneCues, speechSceneDialogue } from "@ai-werewolf-arena/game-media/speech-script";
import { speechScript } from "./dialogue";
export const script: VideoScript = {
  source: {
    sessionId: "session_1792238100351_z77m4h",
    fingerprint: "fnv1a64:cf5845e3b6b99845",
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
        title: "真预言家首验查杀，\n为什么全场都信那只狼？",
        body: "12 个 GPT 玩狼人杀 · 预女猎白",
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
        title: "对局信息 · 预女猎白",
        body: "阵容：4 狼人，4 平民，预言家、女巫、猎人、白痴。\n胜负：好人清狼；狼人屠神、屠民，或存活狼数 ≥ 好人数。\n\n猎人：被刀或放逐可开枪；中毒不能开枪。\n白痴：首次被放逐翻牌免死，随后失去投票权。\n女巫：解药、毒药各一瓶，不能自救，每夜至多用一瓶。\n出局不翻牌；警长 1.5 票，出局后警徽按存活座位顺位移交。",
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
          title: "模型与运行配置",
          body: "模型：gpt-6.1-sol × 12　·　基于 pi-agent，独立会话。\n原局为普通玩家人格，保留全部公开发言、夜聊与遗言。\n玩家分别依据自己可见的信息，通过工具自主发言、投票和使用技能。",
        },
      },
      speech: speechSceneCues(speechScript, "intro:rules"),
      emphasis: [
        {
          text: "4 狼人",
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
          text: "存活狼数 ≥ 好人数",
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
        seq: 12,
        type: "wolf_kill_vote_cast",
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
        seq: 34,
        type: "sheriff_withdraw_summary",
      },
      skip: true,
    },
    {
      anchor: {
        seq: 35,
        type: "sheriff_candidates_finalized",
      },
      skip: true,
    },
    {
      anchor: {
        seq: 49,
        type: "last_words_granted",
      },
      skip: true,
    },
    {
      anchor: {
        seq: 63,
        type: "phase_changed",
      },
      skip: true,
    },
    {
      anchor: {
        seq: 77,
        type: "last_words_granted",
      },
      skip: true,
    },
    {
      anchor: {
        seq: 80,
        type: "wolf_tactical_order",
      },
      skip: true,
    },
    {
      anchor: {
        seq: 88,
        type: "wolf_kill_vote_cast",
      },
      skip: true,
    },
    {
      anchor: {
        seq: 89,
        type: "wolf_kill_vote_cast",
      },
      skip: true,
    },
    {
      anchor: {
        seq: 90,
        type: "wolf_kill_vote_cast",
      },
      skip: true,
    },
    {
      anchor: {
        seq: 91,
        type: "wolf_kill_vote_cast",
      },
      skip: true,
    },
    {
      anchor: {
        seq: 106,
        type: "phase_changed",
      },
      skip: true,
    },
    {
      anchor: {
        seq: 119,
        type: "last_words_granted",
      },
      skip: true,
    },
    {
      anchor: {
        seq: 124,
        type: "wolf_tactical_order",
      },
      skip: true,
    },
    {
      anchor: {
        seq: 130,
        type: "wolf_kill_vote_cast",
      },
      skip: true,
    },
    {
      anchor: {
        seq: 131,
        type: "wolf_kill_vote_cast",
      },
      skip: true,
    },
    {
      anchor: {
        seq: 132,
        type: "wolf_kill_vote_cast",
      },
      skip: true,
    },
    {
      anchor: {
        seq: 136,
        type: "phase_changed",
      },
      skip: true,
    },
  ],
  factEdits: [
    {
      anchor: {
        seq: 10,
        kind: "life_committed",
      },
      skip: true,
    },
  ],
  shotEdits: [
    {
      id: "event:1",
      scene: {
        title: "身份与阵营",
        body: "角色分布：1号：狼人，2号：狼人，3号：平民，4号：预言家，5号：平民，6号：女巫，7号：白痴，8号：狼人，9号：狼人，10号：平民，11号：平民，12号：猎人",
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
      id: "fact:2",
      scene: {
        title: "狼刀确认",
        body: "本次狼刀目标：5号。",
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
      id: "event:16",
      scene: {
        title: "女巫行动",
        body: "6号女巫未使用药剂",
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
      id: "event:17",
      scene: {
        title: "预言家行动",
        body: "4号查验8号：狼人",
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
        title: "阶段交替",
        body: "第1天白天，天亮了",
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
      id: "event:31",
      scene: {
        title: "上警结果",
        body: "上警玩家：4号、8号",
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
      id: "event:46",
      scene: {
        title: "警长票型",
        body: "本轮票型已汇总，详情见票型图。",
        bodySource: "event",
        bodyLayout: "structured",
      },
      speech: speechSceneCues(speechScript, "event:46"),
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
        title: "夜晚结算",
        body: "昨夜死亡：5号",
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
        title: "遗言",
        body: speechSceneDialogue(speechScript, "event:50"),
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
        body: "8号选择逆时针（警右）发言",
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
      id: "event:75",
      scene: {
        title: "放逐投票",
        body: "本轮票型已汇总，详情见票型图。",
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
      id: "fact:4",
      scene: {
        title: "死亡确认",
        body: "4号已死亡。",
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
      id: "event:78",
      scene: {
        title: "遗言",
        body: speechSceneDialogue(speechScript, "event:78"),
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
        title: "阶段交替",
        body: "第2天夜晚，天黑请闭眼",
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
      id: "event:81",
      scene: {
        title: "狼人交流",
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
        title: "狼人交流",
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
        title: "狼人交流",
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
        title: "狼人交流",
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
        title: "狼人交流",
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
        title: "狼人交流",
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
        title: "狼人交流",
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
      id: "fact:6",
      scene: {
        title: "狼刀确认",
        body: "本次狼刀目标：3号。",
        bodySource: "event",
        bodyLayout: "structured",
      },
      speech: speechSceneCues(speechScript, "fact:6"),
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
        title: "女巫行动",
        body: "6号对3号使用解药",
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
      id: "fact:8",
      scene: {
        title: "保护结算",
        body: "3号的狼刀伤害被解药阻止。",
        bodySource: "event",
        bodyLayout: "structured",
      },
      speech: speechSceneCues(speechScript, "fact:8"),
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
        body: "第2天白天，天亮了",
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
      id: "event:94",
      scene: {
        title: "夜晚结算",
        body: "昨夜是平安夜",
        bodySource: "event",
        bodyLayout: "structured",
      },
      speech: speechSceneCues(speechScript, "event:94"),
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
        title: "警长定序",
        body: "8号选择逆时针（警右）发言",
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
        title: "白天发言",
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
        title: "白天发言",
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
        title: "白天发言",
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
        title: "白天发言",
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
        title: "白天发言",
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
        title: "白天发言",
        body: speechSceneDialogue(speechScript, "event:101"),
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
      id: "event:102",
      scene: {
        title: "白天发言",
        body: speechSceneDialogue(speechScript, "event:102"),
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
      id: "event:103",
      scene: {
        title: "白天发言",
        body: speechSceneDialogue(speechScript, "event:103"),
        bodySource: "event",
        bodyLayout: "structured",
      },
      speech: speechSceneCues(speechScript, "event:103"),
      camera: [
        {
          frame: 0,
          target: "table",
        },
      ],
      layers: [],
    },
    {
      id: "event:104",
      scene: {
        title: "白天发言",
        body: speechSceneDialogue(speechScript, "event:104"),
        bodySource: "event",
        bodyLayout: "structured",
      },
      speech: speechSceneCues(speechScript, "event:104"),
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
        title: "白天发言",
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
      id: "event:117",
      scene: {
        title: "放逐投票",
        body: "本轮票型已汇总，详情见票型图。",
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
      id: "fact:9",
      scene: {
        title: "死亡确认",
        body: "12号已死亡。",
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
      id: "event:120",
      scene: {
        title: "遗言",
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
        title: "猎人开枪",
        body: "12号猎人开枪带走8号",
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
      layers: [
        {
          id: "hunter-gun-flash",
          kind: "flash",
          space: "screen",
          from: 0,
          durationFrames: 6,
          color: "#f5d991",
          opacity: 0.2,
          clock: {
            anchor: "impact",
          },
        },
      ],
    },
    {
      id: "event:122",
      scene: {
        title: "警徽移交",
        body: "8号将警徽移交给1号",
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
        title: "阶段交替",
        body: "第3天夜晚，天黑请闭眼",
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
      id: "event:125",
      scene: {
        title: "狼人交流",
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
        title: "狼人交流",
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
      id: "event:127",
      scene: {
        title: "狼人交流",
        body: speechSceneDialogue(speechScript, "event:127"),
        bodySource: "event",
        bodyLayout: "structured",
      },
      speech: speechSceneCues(speechScript, "event:127"),
      camera: [
        {
          frame: 0,
          target: "table",
        },
      ],
      layers: [],
    },
    {
      id: "event:128",
      scene: {
        title: "狼人交流",
        body: speechSceneDialogue(speechScript, "event:128"),
        bodySource: "event",
        bodyLayout: "structured",
      },
      speech: speechSceneCues(speechScript, "event:128"),
      camera: [
        {
          frame: 0,
          target: "table",
        },
      ],
      layers: [],
    },
    {
      id: "event:129",
      scene: {
        title: "狼人交流",
        body: speechSceneDialogue(speechScript, "event:129"),
        bodySource: "event",
        bodyLayout: "structured",
      },
      speech: speechSceneCues(speechScript, "event:129"),
      camera: [
        {
          frame: 0,
          target: "table",
        },
      ],
      layers: [],
    },
    {
      id: "fact:12",
      scene: {
        title: "狼刀确认",
        body: "本次狼刀目标：3号。",
        bodySource: "event",
        bodyLayout: "structured",
      },
      speech: speechSceneCues(speechScript, "fact:12"),
      camera: [
        {
          frame: 0,
          target: "table",
        },
      ],
      layers: [],
    },
    {
      id: "event:133",
      scene: {
        title: "女巫行动",
        body: "6号对7号使用毒药",
        bodySource: "event",
        bodyLayout: "structured",
      },
      speech: speechSceneCues(speechScript, "event:133"),
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
        title: "阶段交替",
        body: "第3天白天，天亮了",
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
        title: "夜晚结算",
        body: "昨夜死亡：3号、7号",
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
        title: "终局",
        body: "对局结束：狼人阵营胜利（狼人达半） · 获胜玩家：1号、2号、8号、9号",
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
  ],
};
