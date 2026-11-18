import { BadRequestException, Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { AdminAuthGuard } from './admin-auth.guard';
import { toHttpError } from './http-error.util';
import { SettingsService } from '../settings/settings.service';
import { SchedulesService } from '../schedules/schedules.service';
import { PollsService } from '../polls/polls.service';

@Controller('settings')
@UseGuards(AdminAuthGuard)
export class SettingsController {
  constructor(
    private readonly settings: SettingsService,
    private readonly schedules: SchedulesService,
    private readonly polls: PollsService,
  ) {}

  @Get()
  find() {
    return this.settings.describe();
  }

  @Put()
  async update(@Body() body: { timezone?: string }) {
    if (!body.timezone) throw new BadRequestException('timezone es requerido.');
    try {
      await this.settings.setTimezone(body.timezone);
      // Recurring schedules and polls store a wall-clock hour, so they have to be re-anchored to the new zone.
      const retimed = await this.schedules.retimeAllForTimezone();
      const retimedPolls = await this.polls.retimeAllForTimezone();
      return { ...this.settings.describe(), retimedSchedules: retimed, retimedPolls };
    } catch (err) {
      toHttpError(err);
    }
  }
}
