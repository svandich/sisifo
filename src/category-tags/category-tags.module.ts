import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CategoryTag } from './entities/category-tag.entity';
import { CategoryTagsService } from './category-tags.service';
import { SuscribirmeCommand } from './suscribirme.command';
import { TagsCommand } from './tags.command';
import { CategoriesModule } from '../categories/categories.module';

@Module({
  imports: [TypeOrmModule.forFeature([CategoryTag]), CategoriesModule],
  providers: [CategoryTagsService, SuscribirmeCommand, TagsCommand],
  exports: [CategoryTagsService, SuscribirmeCommand, TagsCommand],
})
export class CategoryTagsModule {}
