/** 负责首次配置初始化提示；输入为初始化状态与显式动作，输出补充缺失示例的按钮。只由用户点击写文件，不替代新建游戏或修改已有配置。 */
import type { Locale } from "@ai-werewolf-arena/game-text";
import { configUiText } from "@ai-werewolf-arena/game-text/workbench-config-ui";
import type { Translator } from "./types";
export function InitializeNotice({
  t,
  locale,
  busy,
  initialize,
}: {
  t: Translator;
  locale: Locale;
  busy: boolean;
  initialize: () => Promise<void>;
}) {
  return (
    <section className="panel config-detail">
      <p>{configUiText(locale, "initializeHelp")}</p>
      <button disabled={busy} onClick={() => void initialize()}>
        {t("initialize")}
      </button>
    </section>
  );
}
