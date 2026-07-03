import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Observable } from 'rxjs';

@Injectable()
export class IpWhitelistGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest();
    const ip = request.ip || request.socket?.remoteAddress || '';

    const whitelist = (process.env.POSTBACK_ALLOWED_IPS || '').split(',').map((s: string) => s.trim()).filter(Boolean);

    if (whitelist.length === 0) {
      return true;
    }

    const allowed = whitelist.some((allowedIp: string) => ip.includes(allowedIp));
    if (!allowed) {
      throw new ForbiddenException('Access denied. IP not whitelisted.');
    }

    return true;
  }
}
