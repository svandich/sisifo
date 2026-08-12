import { BadRequestException, Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { AdminAuthGuard } from './admin-auth.guard';
import { toHttpError } from './http-error.util';
import { ContestsService } from '../contests/contests.service';

@Controller('contests')
@UseGuards(AdminAuthGuard)
export class ContestsController {
  constructor(private readonly contests: ContestsService) {}

  @Get(':platform')
  async list(@Param('platform') platform: string, @Query('query') query?: string) {
    try {
      return await this.contests.fetchContests(platform, query ? { query } : { phase: 'UPCOMING' });
    } catch (err) {
      toHttpError(err);
    }
  }

  @Get(':platform/:id')
  async getById(@Param('platform') platform: string, @Param('id') id: string) {
    try {
      const contest = await this.contests.getContestById(platform, id);
      if (!contest) throw new BadRequestException(`Concurso "${id}" no encontrado en ${platform}.`);
      return contest;
    } catch (err) {
      toHttpError(err);
    }
  }
}
