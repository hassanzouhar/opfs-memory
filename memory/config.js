import path from 'path';
import os from 'os';
// Default configuration values with static path that doesn't require meta.url
const defaultConfig = {
    // Use a static path in user's home directory instead of relative to module
    memoryFilePath: path.join(os.homedir(), '.mcp-memory', 'memory.json'),
};
// Current configuration (will be populated in load())
let currentConfig = null;
// Flag to track if configuration has been loaded
let isConfigLoaded = false;
// Enable debug logging
const DEBUG = process.env.DEBUG_CONFIG === 'true';
// Debug log function
function debugLog(message) {
    if (DEBUG) {
        console.error(`[CONFIG DEBUG] ${message}`);
    }
}
/**
 * Load configuration from environment variables
 */
/**
 * Load configuration from environment variables
 */
export function load() {
    debugLog('Loading configuration');
    try {
        // Initialize with defaults first
        currentConfig = { ...defaultConfig };
        debugLog(`Default config initialized with memoryFilePath: ${currentConfig.memoryFilePath}`);
        // Load memoryFilePath from environment variable with fallback to default
        const memoryFilePathEnv = process.env.MEMORY_FILE_PATH;
        if (memoryFilePathEnv) {
            debugLog(`Found MEMORY_FILE_PATH environment variable: ${memoryFilePathEnv}`);
            // Only resolve the path after config initialization
            currentConfig.memoryFilePath = path.isAbsolute(memoryFilePathEnv)
                ? memoryFilePathEnv
                : path.resolve(process.cwd(), memoryFilePathEnv);
            debugLog(`Resolved memoryFilePath to: ${currentConfig.memoryFilePath}`);
        }
        // Add other configuration loading logic as needed
        // Mark configuration as loaded
        isConfigLoaded = true;
        debugLog('Configuration loaded successfully');
        // Validate configuration
        validateConfiguration();
    }
    catch (error) {
        // Reset configuration state to prevent partial configuration
        isConfigLoaded = false;
        const errorMessage = `Failed to load configuration: ${error instanceof Error ? error.message : String(error)}`;
        debugLog(`ERROR: ${errorMessage}`);
        throw new Error(errorMessage);
    }
}
/**
 * Get a configuration value
 * @param key The configuration key
 * @returns The configuration value
 */
/**
 * Get a configuration value
 * @param key The configuration key
 * @returns The configuration value
 * @throws Error if configuration has not been loaded yet
 */
export function get(key) {
    debugLog(`Accessing configuration key: ${String(key)}`);
    if (!isConfigLoaded || !currentConfig) {
        const error = 'Configuration has not been loaded yet. Call config.load() before accessing values.';
        debugLog(`ERROR: ${error}`);
        throw new Error(error);
    }
    const value = currentConfig[key];
    debugLog(`Retrieved value for ${String(key)}: ${value}`);
    return value;
}
/**
 * Reset configuration to defaults (mainly for testing)
 */
/**
 * Reset configuration to defaults (mainly for testing)
 */
export function reset() {
    debugLog('Resetting configuration to defaults');
    currentConfig = null;
    isConfigLoaded = false;
}
/**
 * Check if configuration has been loaded
 * @returns True if configuration has been loaded, false otherwise
 */
export function isLoaded() {
    debugLog(`Checking if configuration is loaded: ${isConfigLoaded}`);
    return isConfigLoaded;
}
/**
 * Validate required configuration values
 * @throws Error if any required configuration value is missing or invalid
 */
function validateConfiguration() {
    debugLog('Validating configuration');
    if (!currentConfig) {
        throw new Error('Configuration object is null');
    }
    // Check if memoryFilePath is set
    if (!currentConfig.memoryFilePath) {
        throw new Error('Memory file path is not configured');
    }
    debugLog(`Configuration validation passed. memoryFilePath: ${currentConfig.memoryFilePath}`);
    // Add validation for other required configuration values as needed
}
//# sourceMappingURL=config.js.map