/** 本局固定选角：五男七女；主持人与1.2倍语速由通用豆包配置装配。 */
import { createDoubaoCasting } from "../../scripts/video/casting";

export const casting = createDoubaoCasting(
  {
    "player:1": ["zh_male_ruyayichen_uranus_bigtts", "儒雅逸辰 2.0"],
    "player:2": ["zh_female_qingxinnvsheng_uranus_bigtts", "清新女声 2.0"],
    "player:3": ["zh_male_taocheng_uranus_bigtts", "小天 2.0"],
    "player:4": ["zh_male_shaonianzixin_uranus_bigtts", "少年梓辛 2.0"],
    "player:5": ["zh_female_tianmeiyueyue_uranus_bigtts", "甜美悦悦 2.0"],
    "player:6": ["zh_female_cancan_uranus_bigtts", "知性灿灿 2.0"],
    "player:7": ["ICL_uranus_zh_female_yuanqitianmei_tob", "元气甜妹 2.0"],
    "player:8": ["zh_male_m191_uranus_bigtts", "云舟 2.0"],
    "player:9": ["ICL_uranus_zh_female_tiaopigongzhu_tob", "调皮公主 2.0"],
    "player:10": ["zh_female_roumeinvyou_uranus_bigtts", "柔美女友 2.0"],
    "player:11": ["zh_female_wenrouxiaoya_uranus_bigtts", "温柔小雅 2.0"],
    "player:12": ["zh_male_dayi_uranus_bigtts", "大壹 2.0"],
  },
  "用自然、清晰的对话语气表达推理和质疑，不增加台词。",
);
