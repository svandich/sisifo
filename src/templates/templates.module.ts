import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Template } from './entities/template.entity';
import { TemplatesService } from './templates.service';
import { TemplateCommand } from './template.command';

@Module({
  imports: [TypeOrmModule.forFeature([Template])],
  providers: [TemplatesService, TemplateCommand],
  exports: [TemplatesService, TemplateCommand],
})
export class TemplatesModule {}
