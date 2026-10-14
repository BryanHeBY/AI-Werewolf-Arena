/**
 * 负责每局具名随机流；输入种子与路径，输出确定性抽样、独立子流和洗牌副本。
 * 子流只依赖原种子与名字路径，不依赖父流已抽取次数；算法标识用于严格复现，不在此改版本。
 * 元数据及路径冻结，流内部计数仍由实例拥有；抽样能力不包含派生其它流的权限。
 */
export const RANDOM_ALGORITHM = "mulberry32-fnv1a-utf16-v1" as const;
export const RANDOM_STREAM_POLICY = "named-path-v1" as const;

/** 原种子字符串、算法标识和有序路径；trim 仅检查非空，不规范化保存的名字。 */
export interface RandomMetadata {
  seed: string;
  algorithm: typeof RANDOM_ALGORITHM;
  streamPolicy: typeof RANDOM_STREAM_POLICY;
  path: readonly string[];
}

/** 完整运行流可查看复现资料和创建子流；next 每次推进该实例自己的状态。 */
export interface RandomSource {
  readonly metadata: RandomMetadata;
  next(): number;
  fork(name: string): RandomSource;
}

/** 决策方仅取得抽样入口，不取得种子、路径或派生其它流的接口。 */
export interface RandomDraws {
  next(): number;
}

/** 冻结包装对象而不复制流；每次调用仍晚读 source.next 并保原方法 receiver。 */
export function randomDraws(source: RandomSource): RandomDraws {
  return Object.freeze({ next: () => source.next() });
}

class SeededRandom implements RandomSource {
  readonly metadata: RandomMetadata;
  private state: number;

  constructor(seed: string, path: readonly string[] = []) {
    if (!seed.trim()) throw new Error("random_seed_empty");
    this.metadata = Object.freeze({
      seed,
      algorithm: RANDOM_ALGORITHM,
      streamPolicy: RANDOM_STREAM_POLICY,
      path: Object.freeze([...path]),
    });
    // 固定 JSON 数组与 UTF-16 码元参与 FNV-1a；改序列化或按码点迭代都会改变复现序列。
    const input = JSON.stringify([seed, ...path]);
    let hash = 0x811c9dc5;
    for (let index = 0; index < input.length; index++)
      hash = Math.imul(hash ^ input.charCodeAt(index), 0x01000193) >>> 0;
    this.state = hash;
  }

  /** Mulberry32 以无符号 32 位状态推进，输出落在 [0, 1)。 */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let value = this.state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 0x100000000;
  }

  /** 同种子／路径／名字重复 fork 得到同序列的新实例，不消耗当前流。 */
  fork(name: string): RandomSource {
    if (!name.trim()) throw new Error("random_stream_name_empty");
    return new SeededRandom(this.metadata.seed, [...this.metadata.path, name]);
  }
}

/** 未传 seed 时才创建随机 UUID；有 seed 的调用保持显式确定性。 */
export function createRandom(seed: string = crypto.randomUUID()): RandomSource {
  return new SeededRandom(seed);
}

/** Fisher–Yates 只改新数组；由尾到头每轮抽取一次，不校验调用方自定义 next 的返回范围。 */
export function shuffled<T>(values: readonly T[], random: RandomSource): T[] {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index--) {
    const target = Math.floor(random.next() * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}
