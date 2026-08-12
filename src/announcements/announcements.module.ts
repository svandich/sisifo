import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Announcement } from './entities/announcement.entity';
import { AnnouncementsService } from './announcements.service';
import { ContestsModule } from '../contests/contests.module';
import { TemplatesModule } from '../templates/templates.module';
import { CategoriesModule } from '../categories/categories.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { TelegramModule } from '../telegram/telegram.module';
import { CategoryTagsModule } from '../category-tags/category-tags.module';
import { DiscordClientModule } from '../discord-client/discord-client.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Announcement]),
    ContestsModule,
    TemplatesModule,
    CategoriesModule,
    SubscriptionsModule,
    TelegramModule,
    CategoryTagsModule,
    DiscordClientModule,
  ],
  providers: [AnnouncementsService],
  exports: [AnnouncementsService],
})
export class AnnouncementsModule {}
