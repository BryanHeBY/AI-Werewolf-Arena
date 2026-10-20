/**
 * 负责网页与视频共用的排版、阅读表面、框体、连接线和有限动效数值。输入为主题风格，输出仅含 JSON 值的设计 token。
 * 视频尺寸统一以 1920×1080／30fps 为基准，宿主负责缩放；这些值不决定游戏规则、玩家身份或事实揭晓游标。
 */
export interface ThemeTypography {
  referenceWidth: number;
  referenceHeight: number;
  bodyZh: number;
  bodyEn: number;
  /** 发言密度单独控制，不把技能结果／上帝公告一起缩小。 */
  speechBodyZh: number;
  speechBodyEn: number;
  bodyLarge: number;
  chapter: number;
  title: number;
  scene: number;
  result: number;
  speaker: number;
  name: number;
  roleZh: number;
  roleEn: number;
  model: number;
  seat: number;
  aux: number;
  lineHeightZh: number;
  lineHeightEn: number;
  readingMinWidth: number;
  readingMaxWidth: number;
  webBody: number;
  webName: number;
  webRole: number;
}
export interface ThemeSurfaceColors {
  readingColor: string;
  readingText: string;
  readingMuted: string;
}
export interface ThemeSurface extends ThemeSurfaceColors {
  stage: "transparent";
  readingOpacityDay: number;
  readingOpacityNight: number;
  resultOpacity: number;
  ballotOpacity: number;
  cardOpacity: number;
  heroOpacity: number;
  readingMaxHeightRatio: number;
  /** 长发言可用更高阅读面；公告仍沿用独立上限，主题可分别调节。 */
  speechReadingMaxHeightRatio: number;
  /** minimal 的局部阅读面随日夜变化；哥特两种环境均使用骨白字配局部暗衬。 */
  palette: { day: ThemeSurfaceColors; night: ThemeSurfaceColors };
}
export interface ThemeFrame {
  color: string;
  light: string;
  dark: string;
  width: number;
  secondaryWidth: number;
  activeWidth: number;
  cornerSize: number;
  padding: number;
  /** 活动范围与当前发言者分层用色；与角色身份色、请求/实际目标边框分别拥有语义。 */
  activity: {
    wolf: string;
    wolfSpeaker: string;
    candidate: string;
    candidateSpeaker: string;
    withdrawn: string;
  };
}
export interface ThemeConnector {
  choiceWidth: number;
  effectWidth: number;
  heroWidth: number;
  endpointSize: number;
  inset: number;
  choiceDash: number[];
}
export interface ThemeEffect {
  heroSize: number;
  actorSize: number;
  impactOpacity: number;
}
export interface ThemeMotion {
  durationMs: number;
  cameraFrames: number;
  fps: number;
  standard: { establish: number; travel: number; impact: number; settled: number };
  enterDistance: number;
  impactOpacity: number;
  focusPush: number;
}
export interface ThemeSubtitle {
  fontSize: number;
  fontWeight: number;
  lineHeight: number;
  color: string;
  background: string;
  textShadow: string;
  paddingX: number;
  paddingY: number;
  radius: number;
  safeHeight: number;
  /** 以1080p为基准给播放器章节及控制条留出底部距离，由统一布局随画幅缩放。 */
  bottom: number;
}
export interface ThemeOpening {
  inset: number;
  titleSize: number;
  subtitleSize: number;
  repositorySize: number;
  detailsSize: number;
  textShadow: string;
  backdrop: string;
}
export interface ThemeVisualTokens {
  subtitle: ThemeSubtitle;
  opening: ThemeOpening;
  typography: ThemeTypography;
  surface: ThemeSurface;
  frame: ThemeFrame;
  connector: ThemeConnector;
  effect: ThemeEffect;
  motion: ThemeMotion;
}

/** 每次返回新数据，避免调用方修改一个主题后污染另一主题或后续编译。 */
export function createThemeVisualTokens(gothic: boolean): ThemeVisualTokens {
  const dark = {
    readingColor: "#081219",
    readingText: "#efeade",
    readingMuted: "#c3ced2",
  };
  const day = gothic
    ? { ...dark }
    : { readingColor: "#ffffff", readingText: "#162131", readingMuted: "#526174" };
  const night = gothic
    ? { ...dark }
    : { readingColor: "#1b2533", readingText: "#edf1f6", readingMuted: "#b2bfcd" };
  return {
    subtitle: {
      fontSize: 36,
      fontWeight: 650,
      lineHeight: 1.4,
      color: "#fff",
      background: "rgba(0,0,0,.68)",
      textShadow: "0 2px 4px #000, 0 0 6px #000",
      paddingX: 12,
      paddingY: 4,
      radius: 5,
      safeHeight: 108,
      bottom: 144,
    },
    opening: {
      inset: 32,
      titleSize: 64,
      subtitleSize: 34,
      repositorySize: 28,
      detailsSize: 22,
      textShadow: gothic ? "0 2px 8px #000, 0 0 24px #000" : "none",
      backdrop: gothic
        ? "radial-gradient(ellipse, #06101770, #06101718 55%, transparent 75%)"
        : "none",
    },
    typography: {
      referenceWidth: 1920,
      referenceHeight: 1080,
      bodyZh: 32,
      bodyEn: 30,
      speechBodyZh: 26,
      speechBodyEn: 24,
      bodyLarge: 48,
      chapter: 56,
      title: 44,
      scene: 40,
      result: 42,
      speaker: 36,
      name: 28,
      roleZh: 26,
      roleEn: 24,
      model: 22,
      seat: 40,
      aux: 22,
      lineHeightZh: 1.45,
      lineHeightEn: 1.4,
      readingMinWidth: 960,
      readingMaxWidth: 1280,
      webBody: 14,
      webName: 13,
      webRole: 13,
    },
    surface: {
      stage: "transparent",
      ...day,
      readingOpacityDay: gothic ? 0.86 : 0.96,
      readingOpacityNight: gothic ? 0.8 : 0.94,
      resultOpacity: gothic ? 0.86 : 0.96,
      ballotOpacity: 0.92,
      cardOpacity: 0.92,
      heroOpacity: 0.24,
      readingMaxHeightRatio: 0.8,
      speechReadingMaxHeightRatio: 0.9,
      palette: { day, night },
    },
    frame: {
      color: gothic ? "#899398" : "#7b8ca1",
      light: gothic ? "#e7dcc2" : "#d9e4f0",
      dark: gothic ? "#101c21" : "#243348",
      width: 1.5,
      secondaryWidth: 1,
      activeWidth: 3,
      cornerSize: gothic ? 20 : 0,
      padding: 28,
      activity: {
        wolf: gothic ? "#b64c5c" : "#b52e42",
        wolfSpeaker: gothic ? "#ff6a77" : "#d5223b",
        candidate: gothic ? "#b99a61" : "#9b6d17",
        candidateSpeaker: gothic ? "#f5d99b" : "#805400",
        withdrawn: gothic ? "#9099a4" : "#77828f",
      },
    },
    connector: {
      choiceWidth: 2,
      effectWidth: 3,
      heroWidth: 4,
      endpointSize: 18,
      inset: 10,
      choiceDash: [6, 6],
    },
    effect: { heroSize: 410, actorSize: 112, impactOpacity: 0.22 },
    motion: {
      durationMs: gothic ? 220 : 140,
      cameraFrames: gothic ? 18 : 12,
      fps: 30,
      standard: { establish: 0, travel: 8, impact: 24, settled: 40 },
      enterDistance: 6,
      impactOpacity: 0.22,
      focusPush: 1.08,
    },
  };
}
