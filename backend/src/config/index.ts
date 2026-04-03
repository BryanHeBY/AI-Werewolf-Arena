import dotenv from 'dotenv';
import { GameConfig, ModelConfig } from '../core/types';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables from project root
const cwd = process.cwd();
// Check if we're running from backend directory, need to go up one level
const isRunningFromBackend = cwd.endsWith('/backend');
const rootDir = isRunningFromBackend ? path.resolve(cwd, '..') : path.resolve(cwd);
dotenv.config({ path: path.join(rootDir, '.env') });

export interface AppConfig {
  port: number;
  corsOrigin: string;
  modelDefaults: ModelConfig;
  gameConfig: GameConfig;
  gameRecordsDir: string;
}

export function loadConfig(): AppConfig {
  // Load game config from json
  const gameConfigPath = path.join(rootDir, 'configs/game-config.json');
  const gameConfig: GameConfig = JSON.parse(fs.readFileSync(gameConfigPath, 'utf-8'));

  const modelDefaults: ModelConfig = {
    baseURL: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
    apiKey: process.env.OPENAI_API_KEY || '',
    model: process.env.OPENAI_MODEL || 'gpt-4o',
    temperature: parseFloat(process.env.OPENAI_TEMPERATURE || '0.7'),
    maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS || '4096', 10),
  };

  return {
    port: parseInt(process.env.PORT || '3000', 10),
    corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    modelDefaults,
    gameConfig,
    gameRecordsDir: process.env.GAME_RECORDS_DIR || './data/records',
  };
}

export const appConfig = loadConfig();
