/** A named, noncombat instance; authority and life bindings remain runtime-only. */
export interface WallNoteComponent {
  instanceId: string;
  source: { kind: "wall_event"; eventId: "awa_wall_notes_v1"; day: 1 };
  remaining: 0 | 1;
  expired: boolean;
}
