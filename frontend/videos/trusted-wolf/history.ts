/** 负责本局制作修订记录。输入为已确认的标题、模型与节奏，输出可追溯版本；不修改归档。 */
export const history = [
  {
    revision: "soundtrack-v5",
    date: "2026-10-20",
    title: "降低昼夜背景音乐",
    changes: [
      "夜间River Flute从-49降为-57dB RMS，再降低8dB，约为原振幅的40%；白天从-46降为-48dB RMS，轻微降低2dB；人声和动作音效保持现状",
      "复用原始画面重新混音封装，保留全部字幕、章节、昼夜间隔和片尾留白",
    ],
    productionDirectory: "output/videos/trusted-wolf/production",
  },
  {
    revision: "production-layout",
    date: "2026-10-20",
    title: "制作目录与通用工具整理",
    changes: [
      "作者目录采用英文主题名；来源sessionId与录像指纹保留不变",
      "语音生成清单、原生冻结稿移到output/videos/trusted-wolf/，本目录只维护台词、画面、选角和修订",
      "选角装配与制作阶段复用scripts/video/，不重发TTS或覆盖既有成片",
    ],
  },
  {
    revision: "soundtrack-v4",
    date: "2026-10-20",
    title: "夜间配乐再降低3dB",
    changes: [
      "夜间River Flute固定音量从-46降为-49dB RMS，白天配乐与17处动作音效保留原值",
      "保留昼夜600毫秒间隔、字幕延后400毫秒与片尾3秒停顿",
      "基于冻结成片仅替换混音，逐段校验白天音乐、动作音效及画面码流一致",
    ],
    productionDirectory: "output/session_1792238100351_z77m4h/production-v1",
  },
  {
    revision: "soundtrack-v3",
    date: "2026-10-20",
    title: "弱拍点环境配乐与干净昼夜衔接",
    changes: [
      "白天换为Wisps of Whorls，夜晚换为River Flute；采用无打击乐的慢速氛围曲，保留轻薄音色并削弱低频",
      "背景固定音量从-40降到-46dB RMS，不随发言压低；昼夜配乐先后淡出淡入，中间留600毫秒，避免两首音乐叠加",
      "去掉三次天亮额外铃声，保留上帝播报和狼刀、用药、猎人开枪等其余17处动作音效",
      "原人声、字幕和全部画面时间保留，导出独立第三版及天亮、入夜衔接短片；上一版仍可对照",
    ],
    productionDirectory: "output/session_1792238100351_z77m4h/production-v1",
  },
  {
    revision: "soundtrack-v2",
    date: "2026-10-20",
    title: "轻盈森林与魔法配乐",
    changes: [
      "按反馈去掉原先厚重、宏大的背景音乐，白天改为Confused State，夜晚改为Night Cave",
      "改用马林巴、拇指琴和少量木管的小编制，无弦乐、合唱或大型管弦铺陈；固定低音量，不按发言压低",
      "保留全部20处原音效和原人声，独立导出第二版配乐，并提供六首候选的纯音乐与对白试听",
      "新增Kevin MacLeod音乐署名及CC BY 4.0来源，保留上一版成片与素材",
    ],
    productionDirectory: "output/session_1792238100351_z77m4h/production-v1",
  },
  {
    revision: "soundtrack-v1",
    date: "2026-10-20",
    title: "白天黑夜配乐与动作音效",
    changes: [
      "白天采用Valley Sunset，夜晚采用Forest Treasure，统一约-39dB RMS的低音量；发言期间不额外压低",
      "昼夜切换交叉淡化，音乐循环连接处交叉淡化；结尾淡出并留400毫秒静默",
      "三次狼刀确认均配短刀声；查验、用药、票型结果、警徽、猎人开枪和终局使用独立音效，共20处",
      "配乐稿引用场景和口播行ID，沿用真实语音、字幕与画面时间；复制原画面码流导出独立版本",
      "素材和许可依据保存在output/video-audio-library，配乐版保留署名清单，原纯配音版保留",
    ],
    productionDirectory: "output/session_1792238100351_z77m4h/production-v1",
  },
  {
    revision: "edit-v1",
    date: "2026-10-20",
    title: "完整对局首版成片制作",
    changes: [
      "保留原生完整流程快照和可直接编辑的完整画面副本；口播与玩家全文由JSONL统一拥有",
      "保留所有公开发言、狼队夜聊和遗言；省略投刀明细及重复流程页，保留狼刀确认与完整票型",
      "采用豆包2.0、1.2倍语速，玩家换人额外600毫秒，字幕延后400毫秒，终局停留3秒",
      "片头与规则页作者旁白独立于上帝；规则和模型配置在原生舞台呈现",
    ],
    model: "gpt-6.1-sol",
    casting: "五男七女",
    productionDirectory: "output/session_1792238100351_z77m4h/production-v1",
  },
];
