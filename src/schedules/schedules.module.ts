import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RecurringSchedule } from './entities/recurring-schedule.entity';
import { RecurringScheduleContest } from './entities/recurring-schedule-contest.entity';
import { SchedulesService } from './schedules.service';
import { CategoriesModule } from '../categories/categories.module';
import { ContestsModule } from '../contests/contests.module';
import { AnnouncementsModule } from '../announcements/announcements.module';
import { TemplatesModule } from '../templates/templates.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([RecurringSchedule, RecurringScheduleContest]),
    CategoriesModule,
    ContestsModule,
    AnnouncementsModule,
    TemplatesModule,
  ],
  providers: [SchedulesService],
  exports: [SchedulesService],
})
export class SchedulesModule {}
