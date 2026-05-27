import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Template } from './entities/template.entity';

export const DEFAULT_CONTEST_TEMPLATE = `**{{contest_name}}**
Plataforma: {{platform}}
Inicio: {{start_time}}
Duración: {{duration}}
Enlace: {{contest_url}}`;

export const DEFAULT_VIRTUAL_TEMPLATE = `Contest de hoy: ***{{contest_url}}***

🚨 **Recuerden colocar \`Virtual Participation\` a las {{vp_time}}** 🚨
¡Éxito!`;

// Simulacion admin template — shown only to adminOnly subscriptions
export const DEFAULT_SIMULACION_ADMIN_TEMPLATE = `🔒 **Simulación: {{contest_name}}** ({{platform}})
Inicio: {{start_time}}
Duración: {{duration}}
Enlace: {{contest_url}}`;

// Simulacion public template — hides contest identity
export const DEFAULT_SIMULACION_PUBLIC_TEMPLATE = `🏋️ **Simulación**
Inicio: {{start_time}}
Duración: {{duration}}`;

@Injectable()
export class TemplatesService {
  constructor(
    @InjectRepository(Template)
    private readonly repo: Repository<Template>,
  ) {}

  async create(guildId: string, name: string, content: string): Promise<Template> {
    const existing = await this.repo.findOneBy({ guildId, name });
    if (existing) throw new Error(`Template "${name}" already exists.`);
    return this.repo.save(this.repo.create({ guildId, name, content }));
  }

  async update(guildId: string, name: string, content: string): Promise<Template> {
    const template = await this.findOne(guildId, name);
    template.content = content;
    return this.repo.save(template);
  }

  async findAll(guildId: string): Promise<Template[]> {
    return this.repo.findBy({ guildId });
  }

  async findOne(guildId: string, name: string): Promise<Template> {
    const template = await this.repo.findOneBy({ guildId, name });
    if (!template) throw new NotFoundException(`Template "${name}" not found.`);
    return template;
  }

  async delete(guildId: string, name: string): Promise<void> {
    await this.findOne(guildId, name);
    await this.repo.delete({ guildId, name });
  }

  render(content: string, variables: Record<string, string>): string {
    return content.replace(/\{\{(\w+)\}\}/g, (_, key) => variables[key] ?? `{{${key}}}`);
  }

  async renderTemplate(guildId: string, templateName: string | null, variables: Record<string, string>, fallback = DEFAULT_CONTEST_TEMPLATE): Promise<string> {
    const content = templateName
      ? (await this.findOne(guildId, templateName)).content
      : fallback;
    return this.render(content, variables);
  }
}
