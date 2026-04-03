import OpenAI from 'openai';
import { ModelConfig, AgentOutput } from '../core/types';
import { withRetry, defaultRetryOptions, RetryOptions } from './Retry';

export class OpenAIClient {
  private client: OpenAI;
  private modelConfig: ModelConfig;
  private retryOptions: RetryOptions;

  constructor(config: ModelConfig, retryOptions: RetryOptions = defaultRetryOptions) {
    this.modelConfig = config;
    this.retryOptions = retryOptions;
    this.client = new OpenAI({
      baseURL: config.baseURL,
      apiKey: config.apiKey,
    });
  }

  async chat(systemPrompt: string, userMessage: string): Promise<AgentOutput> {
    return withRetry(async () => {
      const response = await this.client.chat.completions.create({
        model: this.modelConfig.model,
        temperature: this.modelConfig.temperature,
        max_tokens: this.modelConfig.maxTokens,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userMessage },
        ],
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('Empty response from OpenAI');
      }

      let thought = '';
      const thinkMatch = content.match(/<think>([\s\S]*?)<\/think>/);
      if (thinkMatch) {
        thought = thinkMatch[1].trim();
      }

      let cleanContent = content
        .replace(/<think>[\s\S]*?<\/think>/g, '')
        .replace(/```[\s\S]*?```/g, (match) => {
          const codeContent = match.match(/```(?:json|js|javascript)?\n([\s\S]*?)```/);
          return codeContent ? codeContent[1] : match;
        });

      const jsonMatch = cleanContent.match(/\{[\s\S]*\}/);
      const jsonContent = jsonMatch ? jsonMatch[0] : cleanContent;

       try {
         let cleanedJsonContent = jsonContent.replace(/"([^"\\]*(\\.[^"\\]*)*)"/g, (match) => {
           return match.replace(/\n/g, '\\n').replace(/\r/g, '\\r');
         });
         
         const parsed = JSON.parse(cleanedJsonContent) as AgentOutput;
         if (thought) {
           parsed.thought = thought;
         }
         this.validateOutput(parsed);
         return parsed;
       } catch (error) {
         console.error('Failed to parse JSON from LLM after cleaning:', content);
         console.error('Extracted thought:', thought);
         console.error('Clean content:', cleanContent);
         console.error('JSON content:', jsonContent);
         throw error;
       }
    }, this.retryOptions);
  }

  private validateOutput(output: unknown): asserts output is AgentOutput {
    if (!output || typeof output !== 'object') {
      throw new Error('Output is not an object');
    }

    const o = output as Partial<AgentOutput>;
    
    if (typeof o.thought !== 'string') {
      throw new Error('Missing or invalid "thought" field (must be string)');
    }

    if (!o.action || typeof o.action !== 'object') {
      throw new Error('Missing or invalid "action" field (must be object)');
    }

    if (typeof o.action.type !== 'string' || !['kill', 'save', 'poison', 'check', 'speak', 'vote', 'no_action'].includes(o.action.type)) {
      throw new Error(`Invalid action type: ${o.action.type}`);
    }
  }
}
