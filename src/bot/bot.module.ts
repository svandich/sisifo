import { Module } from '@nestjs/common';
import { BotService } from './bot.service';
import { ContestsModule } from '../contests/contests.module';
import { CategoryTagsModule } from '../category-tags/category-tags.module';
import { DiscordClientModule } from '../discord-client/discord-client.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';

@Module({
  imports: [ContestsModule, CategoryTagsModule, DiscordClientModule, SubscriptionsModule],
  providers: [BotService],
})
export class BotModule {}
