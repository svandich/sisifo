import { BadRequestException, Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AdminAuthGuard } from './admin-auth.guard';
import { toHttpError } from './http-error.util';
import { CategoriesService } from '../categories/categories.service';

@Controller('categories')
@UseGuards(AdminAuthGuard)
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Get()
  findAll() {
    return this.categories.findAll();
  }

  @Post()
  async create(@Body() body: { displayName?: string; type?: 'normal' | 'simulacion' }) {
    if (!body.displayName?.trim()) throw new BadRequestException('El nombre es requerido.');
    try {
      return await this.categories.createFromName(body.displayName.trim(), body.type ?? 'normal');
    } catch (err) {
      toHttpError(err);
    }
  }

  @Delete(':slug')
  async remove(@Param('slug') slug: string) {
    try {
      await this.categories.delete(slug);
      return { ok: true };
    } catch (err) {
      toHttpError(err);
    }
  }
}
