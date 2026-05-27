import { Injectable } from '@nestjs/common';
import {
  ChatInputCommandInteraction,
  MessageFlags,
  PermissionsBitField,
  SlashCommandBuilder,
} from 'discord.js';
import { ISlashCommand } from '../bot/slash-command.interface';
import { CategoriesService } from './categories.service';

@Injectable()
export class CategoryCommand implements ISlashCommand {
  constructor(private readonly categories: CategoriesService) {}

  readonly data = new SlashCommandBuilder()
    .setName('categoria')
    .setDescription('Gestionar categorías de anuncios')
    .addSubcommand((sub) =>
      sub
        .setName('agregar')
        .setDescription('Crear una nueva categoría de anuncios')
        .addStringOption((o) =>
          o.setName('nombre').setDescription('Nombre de la categoría (ej: Entrenamiento Semanal)').setRequired(true),
        )
        .addStringOption((o) =>
          o
            .setName('tipo')
            .setDescription('Tipo de categoría')
            .setRequired(false)
            .addChoices(
              { name: 'Concurso próximo (anunciado 30 min antes)', value: 'normal' },
              { name: 'Simulación (anunciada 5 min antes, concurso oculto al público)', value: 'simulacion' },
            ),
        ),
    )
    .addSubcommand((sub) => sub.setName('lista').setDescription('Ver todas las categorías disponibles'));

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const sub = interaction.options.getSubcommand();
    try {
      if (sub === 'agregar') await this.handleAgregar(interaction);
      else if (sub === 'lista') await this.handleLista(interaction);
    } catch (err) {
      const msg = `Error: ${err.message}`;
      if (interaction.deferred || interaction.replied) await interaction.editReply(msg);
      else await interaction.reply({ content: msg, flags: MessageFlags.Ephemeral });
    }
  }

  private async handleAgregar(interaction: ChatInputCommandInteraction) {
    if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.ManageGuild)) {
      await interaction.reply({
        content: 'Necesitas el permiso "Gestionar Servidor" para crear categorías.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const nombre = interaction.options.getString('nombre', true).trim();
    const tipo = (interaction.options.getString('tipo') ?? 'normal') as 'normal' | 'simulacion';
    const slug = nombre.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_áéíóúüñ]/g, '').replace(/[áéíóúüñ]/g, (c) =>
      ({ á: 'a', é: 'e', í: 'i', ó: 'o', ú: 'u', ü: 'u', ñ: 'n' }[c] ?? c),
    );

    const category = await this.categories.create(slug, nombre, tipo);
    const tipoLabel = tipo === 'simulacion' ? ' (simulación)' : '';
    await interaction.reply({
      content: `✅ Categoría **${category.displayName}**${tipoLabel} creada con slug \`${category.slug}\`.`,
      flags: MessageFlags.Ephemeral,
    });
  }

  private async handleLista(interaction: ChatInputCommandInteraction) {
    const cats = await this.categories.findAll();
    if (!cats.length) {
      await interaction.reply({
        content: 'No hay categorías registradas. Usa `/categoria agregar` para crear una.',
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    const list = cats.map((c) => `• **${c.displayName}** — \`${c.slug}\`${c.type === 'simulacion' ? ' *(simulación)*' : ''}`).join('\n');
    await interaction.reply({ content: `**Categorías disponibles:**\n${list}`, flags: MessageFlags.Ephemeral });
  }
}
