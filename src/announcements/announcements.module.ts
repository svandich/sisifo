import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Announcement } from './entities/announcement.entity';
import { AnnouncementsService } from './announcements.service';
import { AnnounceCommand } from './announce.command';
import { ContestsModule } from '../contests/contests.module';
import { TemplatesModule } from '../templates/templates.module';
import { CategoriesModule } from '../categories/categories.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { TelegramModule } from '../telegram/telegram.module';
import { CategoryTagsModule } from '../category-tags/category-tags.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([Announcement]),
    ContestsModule,
    TemplatesModule,
    CategoriesModule,
    SubscriptionsModule,
    TelegramModule,
    CategoryTagsModule,
  ],
  providers: [AnnouncementsService, AnnounceCommand],
  exports: [AnnouncementsService, AnnounceCommand],
})
export class AnnouncementsModule {}
