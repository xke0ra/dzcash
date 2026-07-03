import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import pino from 'pino';

@Injectable()
export class LoggerService implements OnModuleInit {
  private logger!: pino.Logger;

  constructor(private config: ConfigService) {}

  onModuleInit() {
    const isProduction = this.config.get('NODE_ENV') === 'production';
    this.logger = pino({
      level: this.config.get('LOG_LEVEL', isProduction ? 'info' : 'debug'),
      transport: isProduction
        ? undefined
        : {
            target: 'pino-pretty',
            options: { colorize: true, translateTime: 'HH:MM:ss Z' },
          },
      redact: ['req.headers.authorization', 'req.headers.cookie', 'body.password', 'body.passwordHash'],
      serializers: {
        req: pino.stdSerializers.req,
        res: pino.stdSerializers.res,
        err: pino.stdSerializers.err,
      },
      timestamp: pino.stdTimeFunctions.isoTime,
    });
  }

  info(obj: any, msg?: string) {
    this.logger.info(obj, msg);
  }

  warn(obj: any, msg?: string) {
    this.logger.warn(obj, msg);
  }

  error(obj: any, msg?: string) {
    this.logger.error(obj, msg);
  }

  debug(obj: any, msg?: string) {
    this.logger.debug(obj, msg);
  }

  fatal(obj: any, msg?: string) {
    this.logger.fatal(obj, msg);
  }

  getLogger(): pino.Logger {
    return this.logger;
  }
}
