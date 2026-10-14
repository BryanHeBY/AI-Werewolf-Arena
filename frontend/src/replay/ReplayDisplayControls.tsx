/**
 * 负责复盘语言与时区选择控件。输入为当前显示选项，输出只含被修改字段的回调参数。
 * 当前非预设时区也保留为可见选项；控件不校验归档或自行修改播放帧与持久化数据。
 */
import { text } from "@ai-werewolf-arena/game-text";
import { REPLAY_TIME_ZONES, type ReplayDisplayOptions } from "./replay-display";

export function ReplayDisplayControls({
  display,
  onChange,
}: {
  display: ReplayDisplayOptions;
  onChange: (next: Partial<ReplayDisplayOptions>) => void;
}) {
  return (
    <div className="display-controls">
      <label>
        {text(display.locale, "replay.language")}
        <select
          aria-label={text(display.locale, "replay.language")}
          value={display.locale}
          onChange={(event) => onChange({ locale: event.target.value === "en" ? "en" : "zh-CN" })}
        >
          <option value="zh-CN">中文</option>
          <option value="en">English</option>
        </select>
      </label>
      <label>
        {text(display.locale, "replay.timezone")}
        <select
          aria-label={text(display.locale, "replay.timezone")}
          value={display.timeZone}
          onChange={(event) => onChange({ timeZone: event.target.value })}
        >
          {!REPLAY_TIME_ZONES.some((zone) => zone === display.timeZone) && (
            <option value={display.timeZone}>{display.timeZone}</option>
          )}
          {REPLAY_TIME_ZONES.map((zone) => (
            <option key={zone} value={zone}>
              {zone}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
