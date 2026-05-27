import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { BotModule } from './bot/bot.module';
import { Template } from './templates/entities/template.entity';
import { Announcement } from './announcements/entities/announcement.entity';
import { Category } from './categories/entities/category.entity';
import { Subscription } from './subscriptions/entities/subscription.entity';
import { CategoryTag } from './category-tags/entities/category-tag.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'better-sqlite3',
        database: config.get<string>('DATABASE_PATH', './data/sisifo.sqlite'),
        entities: [Template, Announcement, Category, Subscription, CategoryTag],
        synchronize: true,
      }),
    }),
    BotModule,
  ],
})
export class AppModule {}
