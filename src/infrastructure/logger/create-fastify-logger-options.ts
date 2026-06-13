import pino from 'pino';
import type { AppConfig } from '../../config.js';

export function createFastifyLoggerOptions(
  config: AppConfig,
): pino.LoggerOptions {
  const options: pino.LoggerOptions = {
    level: config.logLevel,
    timestamp: pino.stdTimeFunctions.isoTime,
  };

  if (config.mode === 'development') {
    return {
      ...options,
      transport: {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
        },
      },
    };
  }

  return options;
}
