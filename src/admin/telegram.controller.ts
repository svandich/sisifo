import { Controller, Get, UseGuards } from '@nestjs/common';
import { AdminAuthGuard } from './admin-auth.guard';
import { TelegramRegistryService } from '../telegram/telegram-registry.service';

@Controller('telegram')
@UseGuards(AdminAuthGuard)
export class TelegramController {
  constructor(private readonly registry: TelegramRegistryService) {}

  @Get('chats')
  async chats() {
    const chats = await this.registry.findAllChats();
    return Promise.all(
      chats.map(async (chat) => ({
        ...chat,
        topics: await this.registry.findTopicsForChat(chat.chatId),
      })),
    );
  }
}
