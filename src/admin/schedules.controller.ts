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
  async setActive(@Param('id') id: string, @Body() body: { active?: boolean }) {
    if (body.active == null) throw new BadRequestException('active es requerido.');
    try {
      return await this.schedules.setActive(Number(id), body.active);
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
