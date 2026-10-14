/**
 * 负责被动赠枪数据和有限运行读取类型。输入为原授予／转移数据，输出保留枪的元数据、
 * 一次库存及 gift／transfer 来源的原深只读类型，本契约唯一声明结构，不复制或冻结对象。
 * 声明不持有活跃 World／生命、不武装资源、不验证许可或扣库存；原引用和写权仍归运行所有者。
 * 原生猎人／狼王枪与本结构不同，不能因相同 gun 名称就合并来源或死亡资格。
 */
import type { AbilitySource } from "./night-ability-data";

export interface DeathGun {
  id: string;
  kind: "gun";
  /** 来历只限 gift／transfer；数据字段不提供赠予者的库存写权或原生枪身份。 */
  source: Extract<AbilitySource, { kind: "gift" | "transfer" }>;
  sourceDisclosed: false;
  /** 授予夜与武装夜分列，不能仅凭授予记录或剩余数量推断死亡时可以开枪。 */
  grantedNight: number;
  /** null 保留未武装状态；非空也不能取代实际死亡因果、原生命与当前枪窗口检查。 */
  armedOnNight: number | null;
  remaining: 0 | 1;
  disabled: boolean;
  deathExpired: boolean;
}

/** 原对象的有限只读类型，source 字段也只读；不制作副本或产生运行时冻结／资格快照。 */
export type DeathGunReadView = Readonly<Omit<DeathGun, "source">> & {
  readonly source: Readonly<DeathGun["source"]>;
};
