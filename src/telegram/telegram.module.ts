import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TelegramService } from './telegram.service';
import { TelegramRegistryService } from './telegram-registry.service';
import { TelegramChat } from './entities/telegram-chat.entity';
import { TelegramTopic } from './entities/telegram-topic.entity';
import { CategoriesModule } from '../categories/categories.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { CategoryTagsModule } from '../category-tags/category-tags.module';

@Module({
  imports: [TypeOrmModule.forFeature([TelegramChat, TelegramTopic]), CategoriesModule, SubscriptionsModule, CategoryTagsModule],
  providers: [TelegramService, TelegramRegistryService],
  exports: [TelegramService, TelegramRegistryService],
})
export class TelegramModule {}
