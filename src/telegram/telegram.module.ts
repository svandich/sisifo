import { Module } from '@nestjs/common';
import { TelegramService } from './telegram.service';
import { CategoriesModule } from '../categories/categories.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { CategoryTagsModule } from '../category-tags/category-tags.module';

@Module({
  imports: [CategoriesModule, SubscriptionsModule, CategoryTagsModule],
  providers: [TelegramService],
  exports: [TelegramService],
})
export class TelegramModule {}
