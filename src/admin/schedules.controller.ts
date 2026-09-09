import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { AdminAuthGuard } from './admin-auth.guard';
import { toHttpError } from './http-error.util';
import { SchedulesService } from '../schedules/schedules.service';

@Controller('schedules')
@UseGuards(AdminAuthGuard)
export class SchedulesController {
  constructor(private readonly schedules: SchedulesService) {}

  @Get()
  findAll() {
    return this.schedules.findAll();
  }

  @Post()
  async create(
    @Body()
    body: {
      categorySlug?: string;
      intervalDays?: number;
      hour?: number;
      minute?: number;
      guildId?: string;
      templateName?: string;
    },
  ) {
    if (!body.categorySlug || body.intervalDays == null || body.hour == null || body.minute == null) {
      throw new BadRequestException('categorySlug, intervalDays, hour y minute son requeridos.');
    }
    try {
      return await this.schedules.create({
        categorySlug: body.categorySlug,
        intervalDays: Number(body.intervalDays),
        hour: Number(body.hour),
        minute: Number(body.minute),
        guildId: body.guildId,
        templateName: body.templateName,
      });
    } catch (err) {
      toHttpError(err);
    }
  }

  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() body: { active?: boolean; hour?: number; minute?: number; nextContestId?: number },
  ) {
    const retiming = body.hour != null || body.minute != null;
    const repicking = body.nextContestId != null;
    if (body.active == null && !retiming && !repicking) {
      throw new BadRequestException('Se requiere active, hour y minute, o nextContestId.');
    }
    if (retiming && (body.hour == null || body.minute == null)) {
      throw new BadRequestException('hour y minute deben enviarse juntos.');
    }
    try {
      let schedule;
      if (retiming) schedule = await this.schedules.updateTime(Number(id), Number(body.hour), Number(body.minute));
      if (repicking) schedule = await this.schedules.setNextContest(Number(id), Number(body.nextContestId));
      if (body.active != null) schedule = await this.schedules.setActive(Number(id), body.active);
      return schedule;
    } catch (err) {
      toHttpError(err);
    }
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    try {
      await this.schedules.delete(Number(id));
      return { ok: true };
    } catch (err) {
      toHttpError(err);
    }
  }

  @Post(':id/contests')
  async addContest(@Param('id') id: string, @Body() body: { platform?: string; externalId?: string }) {
    if (!body.platform || !body.externalId) throw new BadRequestException('platform y externalId son requeridos.');
    try {
      return await this.schedules.addContest(Number(id), body.platform, body.externalId);
    } catch (err) {
      toHttpError(err);
    }
  }

  @Delete(':id/contests/:contestId')
  async removeContest(@Param('id') id: string, @Param('contestId') contestId: string) {
    try {
      await this.schedules.removeContest(Number(id), Number(contestId));
      return { ok: true };
    } catch (err) {
      toHttpError(err);
    }
  }
}
