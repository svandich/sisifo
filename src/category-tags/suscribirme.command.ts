import { Injectable } from '@nestjs/common';
import { ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder } from 'discord.js';
import { ISlashCommand } from '../bot/slash-command.interface';
import { CategoryTagsService } from './category-tags.service';
import { CategoriesService } from '../categories/categories.service';

@Injectable()
export class SuscribirmeCommand implements ISlashCommand {
  constructor(
    private readonly categoryTags: CategoryTagsService,
    private readonly categories: CategoriesService,
  ) {}

  readonly data = new SlashCommandBuilder()
    .setName('suscribirme')
    .setDescription('Gestionar mis menciones en anuncios de categorías')
    .addSubcommand((sub) =>
      sub
        .setName('agregar')
        .setDescription('Ser mencionado cuando se anuncie una categoría')
        .addStringOption((o) =>
          o.setName('categoria').setDescription('Slug de la categoría (usa /categoria lista)').setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('eliminar')
        .setDescription('Dejar de ser mencionado en anuncios de una categoría')
        .addStringOption((o) => o.setName('categoria').setDescription('Slug de la categoría').setRequired(true)),
    );

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const guildId = interaction.guildId;
    if (!guildId) {
      await interaction.reply({ content: 'Este comando solo puede usarse dentro de un servidor.', flags: MessageFlags.Ephemeral });
      return;
    }

    const sub = interaction.options.getSubcommand();
    try {
      if (sub === 'agregar') await this.handleAgregar(interaction, guildId);
      else if (sub === 'eliminar') await this.handleEliminar(interaction, guildId);
    } catch (err) {
      const msg = `Error: ${err.message}`;
      if (interaction.deferred || interaction.replied) await interaction.editReply(msg);
      else await interaction.reply({ content: msg, flags: MessageFlags.Ephemeral });
    }
  }

  private async handleAgregar(interaction: ChatInputCommandInteraction, guildId: string) {
    const categorySlug = interaction.options.getString('categoria', true);
    const userId = interaction.user.id;

    await this.categoryTags.addUserDiscord(guildId, userId, categorySlug);
    const category = await this.categories.findBySlug(categorySlug);
    await interaction.reply({
      content: `✅ Te mencionaré en los anuncios de **${category!.displayName}**. Asegúrate de que el template de esa categoría incluya \`{{tags}}\`.`,
      flags: MessageFlags.Ephemeral,
    });
  }

  private async handleEliminar(interaction: ChatInputCommandInteraction, guildId: string) {
    const categorySlug = interaction.options.getString('categoria', true);
    const userId = interaction.user.id;

    await this.categoryTags.removeUserDiscord(guildId, userId, categorySlug);
    await interaction.reply({
      content: `✅ Ya no serás mencionado en anuncios de **${categorySlug}**.`,
      flags: MessageFlags.Ephemeral,
    });
  }
}
