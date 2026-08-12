import { Controller, Post, UseGuards } from '@nestjs/common';
import { AdminAuthGuard } from './admin-auth.guard';

@Controller('auth')
@UseGuards(AdminAuthGuard)
export class AuthController {
  @Post('verify')
  verify(): { ok: true } {
    return { ok: true };
  }
}
