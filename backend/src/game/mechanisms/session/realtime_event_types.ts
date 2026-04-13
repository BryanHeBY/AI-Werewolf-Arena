/**
 * 实时事件可见性定义。
 */
export type RealtimeVisibility =
  | { scope: "public" }
  | { scope: "wolves_only" }
  | { scope: "private_targets"; targetPlayerIds: number[] };

/**
 * 实时广播事件结构。
 */
export interface RealtimeGameEvent {
  type: string;
  data: Record<string, unknown>;
  timestamp: number;
  visibility?: RealtimeVisibility;
}
