import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RecurringPoll } from './entities/recurring-poll.entity';
import { PollsService } from './polls.service';
import { CategoriesModule } from '../categories/categories.module';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { TelegramModule } from '../telegram/telegram.module';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [TypeOrmModule.forFeature([RecurringPoll]), CategoriesModule, SubscriptionsModule, TelegramModule, SettingsModule],
  providers: [PollsService],
  exports: [PollsService],
})
export class PollsModule {}
