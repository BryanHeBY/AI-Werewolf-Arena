/** 负责本局制作修订记录。输入为已确认的标题、模型与节奏，输出可追溯版本；不修改归档。 */
export const history = [
  {
    revision: "production-layout",
    date: "2026-10-20",
    title: "制作目录与通用工具整理",
    changes: [
      "作者目录采用英文主题名；来源sessionId与录像指纹保留不变",
      "语音生成清单、原生冻结稿移到output/videos/glm-comeback/，本目录只维护台词、画面、选角和修订",
      "选角装配与制作阶段复用scripts/video/，不重发TTS或覆盖既有成片",
    ],
  },
  {
    revision: "soundtrack-v1",
    date: "2026-10-20",
    title: "完整对局配乐与动作音效",
    changes: [
      "沿用已确认的轻氛围配乐：白天Wisps of Whorls为-46dB RMS，夜间River Flute为-49dB RMS",
      "昼夜配乐先淡出再淡入，中间600毫秒间隔；发言时不额外压低音乐",
      "27处音效绑定实际语音节点，保留四次狼刀确认；骑士出剑与决斗结果分别对齐",
      "原人声、全文字幕和画面时间保持一致，片尾保留停顿并淡出",
    ],
    productionDirectory: "output/session_1792443889532_ltr2qg/production-v1",
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
    model: "GLM-5.3",
    casting: "十二种女声",
    productionDirectory: "output/session_1792443889532_ltr2qg/production-v1",
  },
];
