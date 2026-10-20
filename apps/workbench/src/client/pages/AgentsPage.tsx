/**
 * 负责 Agent 向导与连接源码的页面切换；输入已配置目录和翻译函数，输出创建／编辑与刷新动作。
 * 页面仅拥有选中的标签，文件内容和密钥由向导或编辑器拥有，离开时使用共同草稿保护。
 */
import type { Locale } from "@ai-werewolf-arena/game-text";
import type { Catalog, Translator } from "../types";
import { useState } from "react";
import { DocumentEditor } from "../DocumentEditor";
import { useCanLeaveDraft } from "../draft-context";
import { AgentWizard } from "../AgentWizard";
export function AgentsPage({
  catalog,
  t,
  refresh,
}: {
  catalog: Catalog;
  t: Translator;
  locale?: Locale;
  refresh: () => Promise<void>;
}) {
  const canLeave = useCanLeaveDraft();
  const [tab, setTab] = useState<"wizard" | "agents" | "backends">("wizard");
  return (
    <>
      <div className="section-heading">
        <h1>{t("agents")}</h1>
        <div className="segments">
          {["wizard", "agents", "backends"].map((value) => (
            <button
              key={value}
              className={tab === value ? "selected" : ""}
              onClick={() => {
                if (canLeave()) setTab(value as typeof tab);
              }}
            >
              {value === "wizard"
                ? t("newAgent")
                : value === "agents"
                  ? t("agents")
                  : t("connection")}
            </button>
          ))}
        </div>
      </div>
      {tab === "wizard" ? (
        <>
          <div className="agent-summary-grid">
            {catalog.agents.map((a) => (
              <article className="panel agent-summary" key={a.name}>
                <span className="eyebrow">
                  {a.kind?.toUpperCase()} · {a.provider ?? a.backend}
                </span>
                <h3>{a.name}</h3>
                <code>{a.model}</code>
              </article>
            ))}
          </div>
          <AgentWizard catalog={catalog} t={t} onSaved={() => void refresh()} />
        </>
      ) : (
        <DocumentEditor kind={tab} name={tab} t={t} onSaved={() => void refresh()}>
          {(raw) => (
            <div className="form-body">
              <p className="muted">{t("native")}</p>
              <pre>{JSON.stringify(raw, null, 2)}</pre>
            </div>
          )}
        </DocumentEditor>
      )}
    </>
  );
}
