import { Module } from '@nestjs/common';
import { CategoriesModule } from '../categories/categories.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { CategoryTagsModule } from '../category-tags/category-tags.module';
import { TemplatesModule } from '../templates/templates.module';
import { AnnouncementsModule } from '../announcements/announcements.module';
import { ContestsModule } from '../contests/contests.module';
import { DiscordClientModule } from '../discord-client/discord-client.module';
import { TelegramModule } from '../telegram/telegram.module';
import { SchedulesModule } from '../schedules/schedules.module';
import { AuthController } from './auth.controller';
import { CategoriesController } from './categories.controller';
import { SubscriptionsController } from './subscriptions.controller';
import { TagsController } from './tags.controller';
import { TemplatesController } from './templates.controller';
import { AnnouncementsController } from './announcements.controller';
import { ContestsController } from './contests.controller';
import { DiscordController } from './discord.controller';
import { TelegramController } from './telegram.controller';
import { SchedulesController } from './schedules.controller';

@Module({
  imports: [
    CategoriesModule,
    SubscriptionsModule,
    CategoryTagsModule,
    TemplatesModule,
    AnnouncementsModule,
    ContestsModule,
    DiscordClientModule,
    TelegramModule,
    SchedulesModule,
  ],
  controllers: [
    AuthController,
    CategoriesController,
    SubscriptionsController,
    TagsController,
    TemplatesController,
    AnnouncementsController,
    ContestsController,
    DiscordController,
    TelegramController,
    SchedulesController,
  ],
})
export class AdminModule {}
