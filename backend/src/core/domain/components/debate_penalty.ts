/** Public, day-scoped exile penalty; runtime additionally binds its original life. */
export interface DebatePenaltyComponent {
  day: number;
  sourceId: number;
  lifeVersion: number;
}
