const OpenAI = require("openai");

// Load environment variables
require("dotenv").config({ path: "../.env" });

const client = new OpenAI({
  baseURL: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
  apiKey: process.env.OPENAI_API_KEY || "",
});

async function testAPI() {
  console.log("Testing Minimax API connection...");
  console.log("Base URL:", process.env.OPENAI_BASE_URL);
  console.log("Model:", process.env.OPENAI_MODEL);

  try {
    const response = await client.chat.completions.create({
      model: process.env.OPENAI_MODEL || "MiniMax-M2.7",
      temperature: 0.7,
      max_tokens: 100,
      messages: [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: 'Say "Hello, world!" in Chinese.' },
      ],
    });

    console.log("API Test Success!");
    console.log("Response:", response.choices[0]?.message?.content);
  } catch (error) {
    console.error("API Test Failed:");
    console.error("Error:", error.message);
    console.error("Full error:", error);
  }
}

testAPI();
