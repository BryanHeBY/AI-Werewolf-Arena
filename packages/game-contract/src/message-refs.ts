/**
 * Owns the language-neutral message-reference shape used by action requests and
 * archival machine fields. Inputs are a closed MessageKey and optional readonly
 * string/number parameters; output is a serializable reference, never rendered
 * prose. Text formatting owns missing/extra/nonfinite parameter validation and
 * preserves custom user text. This interface grants no runtime action authority.
 */
import type { MessageKey } from "./message-ids";

export interface MessageRef {
  key: MessageKey;
  parameters?: Readonly<Record<string, string | number>>;
}
