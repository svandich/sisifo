import { BadRequestException, Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { AdminAuthGuard } from './admin-auth.guard';
import { toHttpError } from './http-error.util';
import { PollsService, UpdatePollDto } from '../polls/polls.service';

interface PollBody {
  categorySlug?: string;
  question?: string;
  options?: string[];
  weekdays?: number[];
  hour?: number;
  minute?: number;
  isAnonymous?: boolean;
  allowsMultipleAnswers?: boolean;
  active?: boolean;
}

@Controller('polls')
@UseGuards(AdminAuthGuard)
export class PollsController {
  constructor(private readonly polls: PollsService) {}

  @Get()
  findAll() {
    return this.polls.findAll();
  }

  @Post()
  async create(@Body() body: PollBody) {
    if (!body.categorySlug || !body.question || !body.options || !body.weekdays || body.hour == null || body.minute == null) {
      throw new BadRequestException('categorySlug, question, options, weekdays, hour y minute son requeridos.');
    }
    try {
      return await this.polls.create({
        categorySlug: body.categorySlug,
        question: body.question,
        options: body.options,
        weekdays: body.weekdays,
        hour: Number(body.hour),
        minute: Number(body.minute),
        isAnonymous: body.isAnonymous,
        allowsMultipleAnswers: body.allowsMultipleAnswers,
      });
    } catch (err) {
      toHttpError(err);
    }
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: PollBody) {
    const dto: UpdatePollDto = {};
    if (body.categorySlug !== undefined) dto.categorySlug = body.categorySlug;
    if (body.question !== undefined) dto.question = body.question;
    if (body.options !== undefined) dto.options = body.options;
    if (body.weekdays !== undefined) dto.weekdays = body.weekdays;
    if (body.hour != null) dto.hour = Number(body.hour);
    if (body.minute != null) dto.minute = Number(body.minute);
    if (body.isAnonymous !== undefined) dto.isAnonymous = Boolean(body.isAnonymous);
    if (body.allowsMultipleAnswers !== undefined) dto.allowsMultipleAnswers = Boolean(body.allowsMultipleAnswers);
    if (body.active !== undefined) dto.active = Boolean(body.active);
    if (Object.keys(dto).length === 0) throw new BadRequestException('No hay cambios que aplicar.');
    try {
      return await this.polls.update(Number(id), dto);
    } catch (err) {
      toHttpError(err);
    }
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    try {
      await this.polls.delete(Number(id));
      return { ok: true };
    } catch (err) {
      toHttpError(err);
    }
  }

  @Post(':id/send')
  async sendNow(@Param('id') id: string) {
    try {
      return await this.polls.sendNow(Number(id));
    } catch (err) {
      toHttpError(err);
    }
  }
}
