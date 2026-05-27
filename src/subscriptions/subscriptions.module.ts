import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Subscription } from './entities/subscription.entity';
import { SubscriptionsService } from './subscriptions.service';
import { SubscribeCommand } from './subscribe.command';
import { CategoriesModule } from '../categories/categories.module';

@Module({
  imports: [TypeOrmModule.forFeature([Subscription]), CategoriesModule],
  providers: [SubscriptionsService, SubscribeCommand],
  exports: [SubscriptionsService, SubscribeCommand],
})
export class SubscriptionsModule {}
