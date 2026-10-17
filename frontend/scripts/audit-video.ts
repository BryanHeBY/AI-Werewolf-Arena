/**
 * 负责公开真实对局场景审计命令。输入为record路径及策略，默认只读扫描，输出JSON；可显式新建报告并对未处理事件设门禁。
 * 报告文件采用排他创建，避免覆盖原档或旧审计证据；命令不连接模型、语音或浏览器。
 */
import { parseArgs } from "node:util";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { auditVideoRecords } from "./audit-video-records";

if (import.meta.main) {
  try {
    const args = process.argv.slice(2);
    const { values } = parseArgs({
      args: args[0] === "--" ? args.slice(1) : args,
      strict: true,
      allowPositionals: false,
      options: {
        input: { type: "string" },
        output: { type: "string" },
        theme: { type: "string" },
        "max-files": { type: "string" },
        "fail-on": { type: "string" },
      },
    });
    if (values.theme && !["gothic-v1", "minimal-v1"].includes(values.theme))
      throw new Error("video_audit_theme_invalid");
    if (values["fail-on"] && !["error", "unhandled", "generic"].includes(values["fail-on"]))
      throw new Error("video_audit_policy_invalid");
    const report = await auditVideoRecords(
      values.input ?? path.resolve(import.meta.dir, "../../record"),
      {
        themeId: values.theme as "gothic-v1" | "minimal-v1" | undefined,
        ...(values["max-files"] === undefined ? {} : { maxFiles: Number(values["max-files"]) }),
      },
    );
    const json = JSON.stringify(report, null, 2) + "\n";
    if (values.output) await writeFile(path.resolve(values.output), json, { flag: "wx" });
    else console.log(json.trimEnd());
    const { counts } = report.summary;
    const invalidRecords = report.files.some(
      (file) => file.status === "ok" && file.audit.invalidEvents.length > 0,
    );
    if (
      report.truncated ||
      report.summary.failed ||
      (values["fail-on"] === "unhandled" && (counts.unhandled > 0 || invalidRecords)) ||
      (values["fail-on"] === "generic" &&
        (counts.unhandled > 0 || counts.generic_record > 0 || invalidRecords))
    )
      process.exitCode = 1;
  } catch (error) {
    console.error(
      JSON.stringify({
        error:
          error instanceof Error && /^video_[a-z_]+$/.test(error.message)
            ? error.message
            : "video_audit_command_failed",
      }),
    );
    process.exitCode = 1;
  }
}
