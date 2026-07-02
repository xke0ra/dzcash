import { Controller, Get } from '@nestjs/common';
import { HealthService } from './health.service';
import { SkipThrottle } from '@nestjs/throttler';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('Health')
@Controller('api')
export class HealthController {
  constructor(private health: HealthService) {}

  @Get('health')
  @SkipThrottle()
  @ApiOperation({ summary: 'Health check endpoint' })
  async check() {
    return this.health.check();
  }

  @Get('health/live')
  @SkipThrottle()
  @ApiOperation({ summary: 'Liveness probe' })
  liveness() {
    return { status: 'alive', timestamp: new Date().toISOString() };
  }

  @Get('health/ready')
  @SkipThrottle()
  @ApiOperation({ summary: 'Readiness probe' })
  async readiness() {
    const result = await this.health.check();
    return { status: result.status === 'healthy' ? 'ready' : 'not ready', ...result };
  }
}
