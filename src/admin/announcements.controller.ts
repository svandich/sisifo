import { BadRequestException, Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AdminAuthGuard } from './admin-auth.guard';
import { toHttpError } from './http-error.util';
import { AnnouncementsService } from '../announcements/announcements.service';

@Controller('announcements')
@UseGuards(AdminAuthGuard)
export class AnnouncementsController {
  constructor(private readonly announcements: AnnouncementsService) {}

  @Get()
  findAll() {
    return this.announcements.listPending();
  }

  @Post()
  async create(
    @Body()
    body: {
      platform?: string;
      contestId?: string;
      categorySlug?: string;
      cuando?: string;
      templateName?: string;
      guildId?: string;
    },
  ) {
    if (!body.platform || !body.contestId || !body.categorySlug) {
      throw new BadRequestException('platform, contestId y categorySlug son requeridos.');
    }
    try {
      return await this.announcements.scheduleFromContest({
        platform: body.platform,
        contestId: body.contestId,
        categorySlug: body.categorySlug,
        cuando: body.cuando,
        templateName: body.templateName,
        guildId: body.guildId,
      });
    } catch (err) {
      toHttpError(err);
    }
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    try {
      await this.announcements.cancel(Number(id));
      return { ok: true };
    } catch (err) {
      toHttpError(err);
    }
  }
}
