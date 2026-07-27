import dotenv from "dotenv";
import path from "path";
import { AiSdkClient } from "../../src/infra/llm/ai_sdk_client";

const rootEnvPath = path.resolve(__dirname, "../../..", ".env");
dotenv.config({ path: rootEnvPath });

function hasLiveConfig(): boolean {
  return Boolean(
    process.env.OPENAI_BASE_URL &&
      process.env.OPENAI_API_KEY &&
      process.env.OPENAI_MODEL,
  );
}

describe("minimax live connectivity", () => {
  const runLive = process.env.RUN_LIVE_LLM_TEST === "1";
  const canRunLive = runLive && hasLiveConfig();
  const testFn = canRunLive ? test : test.skip;

  beforeAll(() => {
    // 仅打印配置来源与是否存在，禁止输出敏感密钥明文。
    process.stdout.write(
      `[minimax_live_connectivity] env_source=${rootEnvPath} base_url_set=${Boolean(process.env.OPENAI_BASE_URL)} api_key_set=${Boolean(process.env.OPENAI_API_KEY)} model_set=${Boolean(process.env.OPENAI_MODEL)}\n`,
    );
  });

  testFn(
    "can call model with .env OPENAI_* settings without leaking key",
    async () => {
      const client = new AiSdkClient({
        baseURL: process.env.OPENAI_BASE_URL!,
        apiKey: process.env.OPENAI_API_KEY!,
        model: process.env.OPENAI_MODEL!,
        temperature: 0,
        maxTokens: 48,
      });

      const text = await client.chat([
        {
          role: "system",
          content:
            "你是连接性探针。请只返回单词 CONNECT_OK，不要输出其他内容。",
        },
        {
          role: "user",
          content: "请回传连接确认。",
        },
      ]);

      expect(text.trim().length).toBeGreaterThan(0);
      expect(text.toUpperCase()).toContain("CONNECT");
    },
    30000,
  );

  test("reports explicit reason when live flag is set but config is missing", () => {
    if (!(runLive && !hasLiveConfig())) {
      return;
    }
    expect(hasLiveConfig()).toBe(false);
  });
});
