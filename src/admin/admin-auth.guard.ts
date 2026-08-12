import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

@Injectable()
export class AdminAuthGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const token = this.extractToken(request);
    const expected = this.config.getOrThrow<string>('ADMIN_TOKEN');

    if (!token || token !== expected) throw new UnauthorizedException('Token de administrador inválido.');
    return true;
  }

  private extractToken(request: Request): string | undefined {
    const header = request.headers['authorization'];
    if (!header) return undefined;
    const [scheme, value] = header.split(' ');
    return scheme === 'Bearer' ? value : undefined;
  }
}
