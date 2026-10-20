/** 负责复用纯声线规范化。输入为联合声线，输出校验、合成身份和倍率；不读取凭据或访问服务商。 */
export {
  validateVoiceProfile,
  speechSynthesisIdentity,
  voiceSpeedRatio,
} from "@ai-werewolf-arena/game-media/speech-identity";
