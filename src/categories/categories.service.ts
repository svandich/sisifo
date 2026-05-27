import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Category } from './entities/category.entity';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectRepository(Category)
    private readonly repo: Repository<Category>,
  ) {}

  async create(slug: string, displayName: string, type: 'normal' | 'simulacion' = 'simulacion'): Promise<Category> {
    const existing = await this.repo.findOneBy({ slug });
    if (existing) throw new Error(`La categoría "${slug}" ya existe.`);
    return this.repo.save(this.repo.create({ slug, displayName, type }));
  }

  async findAll(): Promise<Category[]> {
    return this.repo.find({ order: { displayName: 'ASC' } });
  }

  async findBySlug(slug: string): Promise<Category | null> {
    return this.repo.findOneBy({ slug });
  }

  async findById(id: number): Promise<Category | null> {
    return this.repo.findOneBy({ id });
  }

  async delete(slug: string): Promise<void> {
    const category = await this.repo.findOneBy({ slug });
    if (!category) throw new NotFoundException(`Categoría "${slug}" no encontrada.`);
    await this.repo.delete(category.id);
  }
}
