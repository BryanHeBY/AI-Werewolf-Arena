import { ActionProvider, ActionRequest, ToolCall } from "../domain/model";

export class NoopActionProvider implements ActionProvider {
  async getAction(_request: ActionRequest): Promise<ToolCall | null> {
    return null;
  }
}

export interface ScriptedEntry {
  match: (request: ActionRequest) => boolean;
  action: ToolCall | null;
}

export class ScriptedActionProvider implements ActionProvider {
  private readonly entries: ScriptedEntry[];

  constructor(entries: ScriptedEntry[]) {
    this.entries = [...entries];
  }

  async getAction(request: ActionRequest): Promise<ToolCall | null> {
    const index = this.entries.findIndex((entry) => entry.match(request));
    if (index === -1) {
      return null;
    }

    const [entry] = this.entries.splice(index, 1);
    return entry.action;
  }
}
