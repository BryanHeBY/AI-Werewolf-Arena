/** Stable per-game streams. Forking depends on names, never on parent consumption. */
export const RANDOM_ALGORITHM = "mulberry32-fnv1a-utf16-v1" as const;
export const RANDOM_STREAM_POLICY = "named-path-v1" as const;

export interface RandomMetadata {
  seed: string;
  algorithm: typeof RANDOM_ALGORITHM;
  streamPolicy: typeof RANDOM_STREAM_POLICY;
  path: readonly string[];
}

export interface RandomSource {
  readonly metadata: RandomMetadata;
  next(): number;
  fork(name: string): RandomSource;
}

class SeededRandom implements RandomSource {
  readonly metadata: RandomMetadata;
  private state: number;

  constructor(seed: string, path: readonly string[] = []) {
    if (!seed.trim()) throw new Error("random_seed_empty");
    this.metadata = Object.freeze({ seed, algorithm: RANDOM_ALGORITHM, streamPolicy: RANDOM_STREAM_POLICY, path: Object.freeze([...path]) });
    const input = JSON.stringify([seed, ...path]);
    let hash = 0x811c9dc5;
    for (let index = 0; index < input.length; index++) hash = Math.imul(hash ^ input.charCodeAt(index), 0x01000193) >>> 0;
    this.state = hash;
  }

  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let value = this.state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 0x100000000;
  }

  fork(name: string): RandomSource {
    if (!name.trim()) throw new Error("random_stream_name_empty");
    return new SeededRandom(this.metadata.seed, [...this.metadata.path, name]);
  }
}

export function createRandom(seed: string = crypto.randomUUID()): RandomSource { return new SeededRandom(seed); }

export function shuffled<T>(values: readonly T[], random: RandomSource): T[] {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index--) {
    const target = Math.floor(random.next() * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}
