import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

interface Config {
  memoryFilePath: string;
  debug: boolean;
}

let config: Config = {
  memoryFilePath: path.join(process.cwd(), 'memory.jsonl'),
  debug: false
};

const defaultConfig: Config = {
  memoryFilePath: path.join(process.cwd(), 'memory.jsonl'),
  debug: false
};

export async function load(): Promise<void> {
  try {
    const configPath = process.env.MCP_CONFIG_PATH || path.join(process.cwd(), 'config.json');
    const configData = await fs.readFile(configPath, 'utf-8');
    const parsedConfig = JSON.parse(configData);
    config = { ...defaultConfig, ...parsedConfig };
    
    if (process.env.DEBUG_CONFIG === 'true') {
      config.debug = true;
    }
    
    validateConfig(config);
  } catch (error) {
    if (error instanceof Error && 'code' in error && (error as any).code === 'ENOENT') {
      console.error('No config file found, using default configuration');
      config = { ...defaultConfig };
    } else {
      throw new Error(`Failed to load configuration: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

function validateConfig(configToValidate: Config): void {
  if (!configToValidate.memoryFilePath) {
    throw new Error('Memory file path is required in configuration');
  }
  
  // Ensure the memory file path is absolute
  if (!path.isAbsolute(configToValidate.memoryFilePath)) {
    configToValidate.memoryFilePath = path.resolve(process.cwd(), configToValidate.memoryFilePath);
  }
}

export function get<K extends keyof Config>(key: K): Config[K] {
  return config[key];
}

export function set<K extends keyof Config>(key: K, value: Config[K]): void {
  config[key] = value;
  
  if (key === 'memoryFilePath') {
    validateConfig(config);
  }
}

export function getAll(): Config {
  return { ...config };
} 