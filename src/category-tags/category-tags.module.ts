import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CategoryTag } from './entities/category-tag.entity';
import { CategoryTagsService } from './category-tags.service';
import { SuscribirmeCommand } from './suscribirme.command';
import { CategoriesModule } from '../categories/categories.module';

@Module({
  imports: [TypeOrmModule.forFeature([CategoryTag]), CategoriesModule],
  providers: [CategoryTagsService, SuscribirmeCommand],
  exports: [CategoryTagsService, SuscribirmeCommand],
})
export class CategoryTagsModule {}
