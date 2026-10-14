/**
 * 负责丘比特恋人关系的上帝视角记录结构；输入为选择时的施法者、目标对、政策与阵营标签，
 * 输出保留首夜关系的可序列化元数据，不含原生命引用、已付关系回调或运行许可。
 * 实际关系绑定、Victory 归属与殉情展开仍归本族所有者，玩家自身关系知识另由投影裁剪。
 */
import type { CupidPolicy } from "./boards";
import type { Camp, EntityId } from "./identity";
/** readonly 声明只限制读取类型；原提交方另冻结记录与目标／阵营对，原生命绑定保存在序列化之外。 */
export interface LoversComponent {
  readonly actorId: EntityId;
  readonly day: 1;
  readonly policy: CupidPolicy;
  readonly pairIds: readonly [EntityId, EntityId];
  /** 保留本次请求候选捕获并在提交前复验的两人阵营；mixed 描述该对是否异阵营，不重新读取后续真实阵营或单独判胜。 */
  readonly pairCamps: readonly [Camp.Good | Camp.Wolf, Camp.Good | Camp.Wolf];
  readonly groupId: "cupid_lovers";
  readonly mixed: boolean;
}
