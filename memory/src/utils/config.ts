import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

interface Config {
  memoryFilePath: string;
  debug: boolean;
}

let config: Config | null = null;

const defaultConfig: Config = {
  memoryFilePath: path.join(process.cwd(), 'memory.jsonl'),
  debug: false
};

export async function load(): Promise<void> {
  try {
    const configPath = process.env.MCP_CONFIG_PATH || path.join(process.cwd(), 'config.json');
    const configData = await fs.readFile(configPath, 'utf-8');
    config = { ...defaultConfig, ...JSON.parse(configData) };
    
    if (process.env.DEBUG_CONFIG === 'true') {
      config.debug = true;
    }
    
    validateConfig(config);
  } catch (error) {
    if (error instanceof Error && 'code' in error && (error as any).code === 'ENOENT') {
      console.error('No config file found, using default configuration');
      config = defaultConfig;
    } else {
      throw new Error(`Failed to load configuration: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

function validateConfig(config: Config): void {
  if (!config.memoryFilePath) {
    throw new Error('Memory file path is required in configuration');
  }
  
  // Ensure the memory file path is absolute
  if (!path.isAbsolute(config.memoryFilePath)) {
    config.memoryFilePath = path.resolve(process.cwd(), config.memoryFilePath);
  }
}

export function get<K extends keyof Config>(key: K): Config[K] {
  if (!config) {
    throw new Error('Configuration not loaded. Call load() first.');
  }
  return config[key];
}

export function set<K extends keyof Config>(key: K, value: Config[K]): void {
  if (!config) {
    throw new Error('Configuration not loaded. Call load() first.');
  }
  config[key] = value;
  
  if (key === 'memoryFilePath') {
    validateConfig(config);
  }
}

export function getAll(): Config {
  if (!config) {
    throw new Error('Configuration not loaded. Call load() first.');
  }
  return { ...config };
} 