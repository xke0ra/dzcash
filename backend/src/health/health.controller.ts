import { Controller, Get } from '@nestjs/common';
import { HealthService } from './health.service';
import { SkipThrottle } from '@nestjs/throttler';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private health: HealthService) {}

  @Get()
  @SkipThrottle()
  @ApiOperation({ summary: 'Health check endpoint' })
  async check() {
    return this.health.check();
  }

  @Get('live')
  @SkipThrottle()
  @ApiOperation({ summary: 'Liveness probe' })
  liveness() {
    return { status: 'alive', timestamp: new Date().toISOString() };
  }

  @Get('ready')
  @SkipThrottle()
  @ApiOperation({ summary: 'Readiness probe' })
  async readiness() {
    const result = await this.health.check();
    return { ...result, status: result.status === 'healthy' ? 'ready' : 'not ready' };
  }
}
