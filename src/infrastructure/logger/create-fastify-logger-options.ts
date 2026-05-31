import pino from 'pino';
import type { AppConfig } from '../../config.js';

export function createFastifyLoggerOptions(
  config: AppConfig,
): pino.LoggerOptions {
  const options: pino.LoggerOptions = {
    level: config.logLevel,
    timestamp: pino.stdTimeFunctions.isoTime,
    redact: {
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        '*.password',
        '*.pass',
        '*.token',
        '*.refreshToken',
        '*.clientSecret',
      ],
      remove: true,
    },
  };

  if (config.mode === 'development' && config.logPretty) {
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
