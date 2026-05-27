import { Module } from '@nestjs/common';
import { BotService } from './bot.service';
import { TemplatesModule } from '../templates/templates.module';
import { ContestsModule } from '../contests/contests.module';
import { AnnouncementsModule } from '../announcements/announcements.module';
import { CategoriesModule } from '../categories/categories.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { CategoryTagsModule } from '../category-tags/category-tags.module';

@Module({
  imports: [TemplatesModule, ContestsModule, AnnouncementsModule, CategoriesModule, SubscriptionsModule, CategoryTagsModule],
  providers: [BotService],
})
export class BotModule {}
