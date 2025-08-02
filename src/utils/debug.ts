interface DebugConfig {
  enabled: boolean;
  logSensitiveData: boolean;
  logLevel: 'error' | 'warn' | 'info' | 'debug';
}

const getDebugConfig = (): DebugConfig => {
  // Use globalThis to access Vite env vars in a TypeScript-safe way
  const env = (globalThis as any).import?.meta?.env || (import.meta as any).env || {};
  const isDevelopment = env.DEV || process.env.NODE_ENV === 'development';
  const debugEnabled = env.VITE_DEBUG === 'true';
  
  return {
    enabled: isDevelopment || debugEnabled,
    logSensitiveData: env.VITE_DEBUG_SENSITIVE === 'true',
    logLevel: (env.VITE_LOG_LEVEL as DebugConfig['logLevel']) || 'info'
  };
};

const config = getDebugConfig();

const logLevels = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3
};

const shouldLog = (level: DebugConfig['logLevel']): boolean => {
  if (!config.enabled) return false;
  return logLevels[level] <= logLevels[config.logLevel];
};

const maskSensitiveData = (data: any): any => {
  if (!config.logSensitiveData && typeof data === 'string') {
    // Mask tokens and passwords
    if (data.includes('Bearer ') || data.length > 50) {
      return data.substring(0, 10) + '***MASKED***';
    }
  }
  return data;
};

const getTimestamp = () => new Date().toLocaleTimeString('en-US', { hour12: false });

const formatLog = (emoji: string, label: string, timestamp: string, ...args: any[]) => {
  return `${emoji} ${label}: ${timestamp}: ${args.join(' ')}`;
};

export const debug = {
  error: (...args: any[]) => {
    if (shouldLog('error')) {
      console.error(formatLog('🚨', 'ERROR', getTimestamp(), ...args.map(maskSensitiveData)));
    }
  },
  
  warn: (...args: any[]) => {
    if (shouldLog('warn')) {
      console.warn(formatLog('⚠️', 'WARN', getTimestamp(), ...args.map(maskSensitiveData)));
    }
  },
  
  info: (...args: any[]) => {
    if (shouldLog('info')) {
      console.info(formatLog('ℹ️', 'INFO', getTimestamp(), ...args.map(maskSensitiveData)));
    }
  },
  
  log: (...args: any[]) => {
    if (shouldLog('debug')) {
      console.log(formatLog('🐛', 'DEBUG', getTimestamp(), ...args.map(maskSensitiveData)));
    }
  },
  
  // Special method for auth-related logs
  auth: (...args: any[]) => {
    if (shouldLog('debug')) {
      const maskedArgs = config.logSensitiveData 
        ? args 
        : args.map(arg => typeof arg === 'string' ? '🔒 ***MASKED***' : arg);
      console.log(formatLog('🔐', 'AUTH', getTimestamp(), ...maskedArgs));
    }
  },
  
  // Method for API responses
  api: (endpoint: string, response: any) => {
    if (shouldLog('debug')) {
      const responseData = config.logSensitiveData 
        ? response 
        : '🔒 Response logged (set VITE_DEBUG_SENSITIVE=true to view)';
      console.log(formatLog('🌐', 'API', getTimestamp(), endpoint, responseData));
    }
  },

  // New method for anime-specific logs
  anime: (...args: any[]) => {
    if (shouldLog('debug')) {
      console.log(formatLog('🍿', 'ANIME', getTimestamp(), ...args.map(maskSensitiveData)));
    }
  },

  // Success logs
  success: (...args: any[]) => {
    if (shouldLog('info')) {
      console.log(formatLog('✅', 'SUCCESS', getTimestamp(), ...args.map(maskSensitiveData)));
    }
  }
};

export default debug;