import { BadRequestException, Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AdminAuthGuard } from './admin-auth.guard';
import { toHttpError } from './http-error.util';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';

@Controller('subscriptions')
@UseGuards(AdminAuthGuard)
export class SubscriptionsController {
  constructor(private readonly subscriptions: SubscriptionsService) {}

  @Get()
  findAll() {
    return this.subscriptions.findAll();
  }

  @Post('discord')
  async createDiscord(
    @Body() body: { guildId?: string; channelId?: string; categorySlug?: string; adminOnly?: boolean },
  ) {
    if (!body.guildId || !body.channelId || !body.categorySlug) {
      throw new BadRequestException('guildId, channelId y categorySlug son requeridos.');
    }
    try {
      return await this.subscriptions.subscribeDiscord(body.guildId, body.channelId, body.categorySlug, body.adminOnly ?? false);
    } catch (err) {
      toHttpError(err);
    }
  }

  @Post('telegram')
  async createTelegram(
    @Body() body: { chatId?: string; threadId?: string; categorySlug?: string; adminOnly?: boolean },
  ) {
    if (!body.chatId || !body.categorySlug) {
      throw new BadRequestException('chatId y categorySlug son requeridos.');
    }
    try {
      return await this.subscriptions.subscribeTelegram(body.chatId, body.categorySlug, body.threadId, body.adminOnly ?? false);
    } catch (err) {
      toHttpError(err);
    }
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    try {
      await this.subscriptions.deleteById(Number(id));
      return { ok: true };
    } catch (err) {
      toHttpError(err);
    }
  }
}
