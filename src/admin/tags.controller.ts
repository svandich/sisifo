import { BadRequestException, Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AdminAuthGuard } from './admin-auth.guard';
import { toHttpError } from './http-error.util';
import { CategoryTagsService } from '../category-tags/category-tags.service';

@Controller('tags')
@UseGuards(AdminAuthGuard)
export class TagsController {
  constructor(private readonly categoryTags: CategoryTagsService) {}

  @Get()
  findAll() {
    return this.categoryTags.findAll();
  }

  @Post('discord/role')
  async addRole(@Body() body: { guildId?: string; roleId?: string; categorySlug?: string }) {
    if (!body.guildId || !body.roleId || !body.categorySlug) {
      throw new BadRequestException('guildId, roleId y categorySlug son requeridos.');
    }
    try {
      await this.categoryTags.addRoleDiscord(body.guildId, body.roleId, body.categorySlug);
      return { ok: true };
    } catch (err) {
      toHttpError(err);
    }
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    try {
      await this.categoryTags.removeById(Number(id));
      return { ok: true };
    } catch (err) {
      toHttpError(err);
    }
  }
}
