import { OpenAIClient } from "../../src/llm/OpenAIClient";

// Mock the entire OpenAI client to prevent real network calls
const mockCreate = jest.fn();

jest.mock("openai", () => {
  const MockOpenAI = jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: mockCreate,
      },
    },
  }));

  return {
    __esModule: true,
    default: MockOpenAI,
  };
});

const mockConfig = {
  baseURL: "https://api.openai.com/v1",
  apiKey: "test-api-key",
  model: "gpt-4o",
  temperature: 0.7,
  maxTokens: 1024,
};

describe("OpenAIClient", () => {
  let client: OpenAIClient;

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();

    // Reset the shared mock
    mockCreate.mockReset();
    // Set default mock response
    mockCreate.mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              thought: "Test thought",
              action: { type: "speak", content: "Test message" },
            }),
          },
        },
      ],
    });

    client = new OpenAIClient(mockConfig);
  });

  // Test constructor
  describe("constructor", () => {
    it("should initialize with provided configuration", () => {
      expect(client).toBeInstanceOf(OpenAIClient);
      expect(client).toBeDefined();
    });

    it("should use default retry options when none provided", () => {
      const defaultClient = new OpenAIClient(mockConfig);
      expect(defaultClient).toBeDefined();
    });

    it("should use custom retry options when provided", () => {
      const customRetryOptions = {
        maxRetries: 5,
        initialDelayMs: 100,
        backoffFactor: 2,
      };
      const customClient = new OpenAIClient(mockConfig, customRetryOptions);
      expect(customClient).toBeDefined();
    });
  });

  // Test chat method
  describe("chat", () => {
    const systemPrompt = "You are a helpful assistant";
    const userMessage = "What is 2+2?";

    it("should make successful API call and parse response", async () => {
      // Setup mock response
      mockCreate.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify({
                thought: "Test thought process",
                action: { type: "speak", content: "Test message" },
              }),
            },
          },
        ],
      });

      const result = await client.chat(systemPrompt, userMessage);

      expect(result).toEqual({
        thought: "Test thought process",
        action: { type: "speak", content: "Test message" },
      });
      expect(mockCreate).toHaveBeenCalled();
    });

    it("should return valid AgentOutput structure", async () => {
      // Setup mock response
      mockCreate.mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: JSON.stringify({
                thought: "Test thought",
                action: { type: "speak", content: "Test message" },
              }),
            },
          },
        ],
      });

      const result = await client.chat(systemPrompt, userMessage);

      expect(result).toHaveProperty("thought");
      expect(result).toHaveProperty("action");
      expect(result.action).toHaveProperty("type");
    });

    it("should handle empty API response gracefully", async () => {
      // Override the default mock to return empty response
      mockCreate.mockResolvedValue({
        choices: [],
      });

      await expect(client.chat(systemPrompt, userMessage)).rejects.toThrow();
    });
  });
});
