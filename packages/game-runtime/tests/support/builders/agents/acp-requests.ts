/**
 * 持有测试 builder：构造字面、有界的 ACP speak ActionRequest，保留原可见事件与回合约束字段。输入为原配置、原始组件对象及调用方字段，输出为原明确夹具值。单元／场景测试沿用未改变的手写字面预期和身份快照；不运行完整对局、传输或生产规则 verifier。
 */
import { Phase, type ActionRequest } from "../../../../src/domain/model";
export function speakRequest(actorId = 1): ActionRequest {
  return {
    actorId,
    phase: Phase.Day,
    allowedTools: ["speak"],
    context: {
      day: 1,
      stage: "day_speech",
      turn_constraints: { min_valid_actions: 1, max_valid_actions: 1 },
      visible_events: [{ seq: 1, type: "phase_changed", payload: { day: 1, phase: "day" } }],
    },
  };
}
