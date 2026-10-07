import { isLocale } from "@ai-werewolf-arena/game-catalog";
import { errorMessage, text, type Locale } from "@ai-werewolf-arena/game-text";
import { describeError } from "../../utils/error_diagnostic";
import { configDiagnostic } from "../config/error_codes";
import { COMMAND_ERROR_CODES } from "./error_codes";

/** One invocation owns this context; it never changes a game or process environment. */
export interface CliDisplayContext { locale: Locale; explicit: boolean }
export function takeDisplayArguments(args: string[], context: CliDisplayContext): string[] {
  const rest: string[] = [];
  for (let index = 0; index < args.length; index++) {
    if (args[index] !== "--display-locale") { rest.push(args[index]); continue; }
    const value = args[++index];
    if (!isLocale(value)) throw new Error("runtime_cli_locale_invalid");
    context.locale = value; context.explicit = true;
  }
  return rest;
}
export function cliFailure(error: unknown, locale: Locale) {
  const configuration = configDiagnostic(error);
  let message: unknown;
  try { message = error && typeof error === "object" ? Object.getOwnPropertyDescriptor(error, "message")?.value : undefined; } catch { /* opaque foreign error */ }
  const candidate = typeof message === "string" ? message.split(":", 1)[0] : "command_failed";
  const code = configuration.code !== "config_check_failed" ? configuration.code
    : COMMAND_ERROR_CODES.includes(candidate as typeof COMMAND_ERROR_CODES[number]) ? candidate : "command_failed";
  const diagnostic = describeError(error);
  const explanation = code === "runtime_cli_locale_invalid" ? text(locale, "cli.locale_invalid")
    : code === "runtime_cli_boolean_invalid" ? text(locale, "cli.boolean_invalid")
    : code === "runtime_cli_option_unknown" ? text(locale, "cli.option_unknown")
    : code === "runtime_cli_value_missing" ? text(locale, "cli.value_missing")
    : code.endsWith("_usage") ? text(locale, "cli.usage_invalid")
    : code === "runtime_locale_execution_not_enabled" || code === "reproduction_locale_not_enabled" ? text(locale, "cli.locale_gate")
    : code.startsWith("runtime_config_") || code.startsWith("board_config_") ? text(locale, "cli.configuration_failed", { code })
    : code.startsWith("reproduction_") ? text(locale, "cli.reproduction_failed", { code })
    : code.startsWith("replay_") ? text(locale, "cli.replay_failed", { code })
    : code.startsWith("simulation_") ? text(locale, "cli.simulation_failed", { code })
    : errorMessage(locale, diagnostic.code);
  return { code, ...(configuration.path ? { path: configuration.path } : {}), diagnostic, message: explanation };
}
/** CLI output/exit boundary only; programmatic command functions still reject their original errors. */
export async function runCli(command: (args: string[], display: CliDisplayContext) => Promise<void>, args = process.argv.slice(2)): Promise<void> {
  const display: CliDisplayContext = { locale: "zh-CN", explicit: false };
  try { await command(args, display); }
  catch (error) { console.error(JSON.stringify(cliFailure(error, display.locale))); process.exitCode = 1; }
}
