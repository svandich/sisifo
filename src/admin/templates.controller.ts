import { BadRequestException, Body, Controller, Delete, Get, Param, Post, Put, Query, UseGuards } from '@nestjs/common';
import { AdminAuthGuard } from './admin-auth.guard';
import { toHttpError } from './http-error.util';
import { TemplatesService } from '../templates/templates.service';

@Controller('templates')
@UseGuards(AdminAuthGuard)
export class TemplatesController {
  constructor(private readonly templates: TemplatesService) {}

  @Get()
  async findAll(@Query('guildId') guildId?: string) {
    if (!guildId) throw new BadRequestException('guildId es requerido.');
    return this.templates.findAll(guildId);
  }

  @Post()
  async create(@Body() body: { guildId?: string; name?: string; content?: string }) {
    if (!body.guildId || !body.name?.trim() || !body.content?.trim()) {
      throw new BadRequestException('guildId, name y content son requeridos.');
    }
    try {
      return await this.templates.create(body.guildId, body.name.trim(), body.content);
    } catch (err) {
      toHttpError(err);
    }
  }

  @Put(':guildId/:name')
  async update(@Param('guildId') guildId: string, @Param('name') name: string, @Body() body: { content?: string }) {
    if (!body.content?.trim()) throw new BadRequestException('content es requerido.');
    try {
      return await this.templates.update(guildId, name, body.content);
    } catch (err) {
      toHttpError(err);
    }
  }

  @Delete(':guildId/:name')
  async remove(@Param('guildId') guildId: string, @Param('name') name: string) {
    try {
      await this.templates.delete(guildId, name);
      return { ok: true };
    } catch (err) {
      toHttpError(err);
    }
  }
}
