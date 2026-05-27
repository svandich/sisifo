import { Injectable } from '@nestjs/common';
import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  PermissionsBitField,
  SlashCommandBuilder,
  roleMention,
  userMention,
} from 'discord.js';
import { ISlashCommand } from '../bot/slash-command.interface';
import { CategoryTagsService } from './category-tags.service';
import { CategoriesService } from '../categories/categories.service';

@Injectable()
export class TagsCommand implements ISlashCommand {
  constructor(
    private readonly categoryTags: CategoryTagsService,
    private readonly categories: CategoriesService,
  ) {}

  readonly data = new SlashCommandBuilder()
    .setName('tags')
    .setDescription('Gestionar roles mencionados en anuncios (solo admins)')
    .addSubcommand((sub) =>
      sub
        .setName('agregar')
        .setDescription('Hacer que un rol sea mencionado en anuncios de una categoría')
        .addRoleOption((o) => o.setName('rol').setDescription('Rol a mencionar').setRequired(true))
        .addStringOption((o) =>
          o.setName('categoria').setDescription('Slug de la categoría').setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('eliminar')
        .setDescription('Quitar un rol de las menciones de una categoría')
        .addRoleOption((o) => o.setName('rol').setDescription('Rol a quitar').setRequired(true))
        .addStringOption((o) =>
          o.setName('categoria').setDescription('Slug de la categoría').setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('lista')
        .setDescription('Ver usuarios y roles con menciones activas en este servidor')
        .addStringOption((o) =>
          o.setName('categoria').setDescription('Filtrar por slug de categoría (opcional)').setRequired(false),
        ),
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
      else if (sub === 'lista') await this.handleLista(interaction, guildId);
    } catch (err) {
      const msg = `Error: ${err.message}`;
      if (interaction.deferred || interaction.replied) await interaction.editReply(msg);
      else await interaction.reply({ content: msg, flags: MessageFlags.Ephemeral });
    }
  }

  private requireAdmin(interaction: ChatInputCommandInteraction): boolean {
    return !!interaction.memberPermissions?.has(PermissionsBitField.Flags.ManageGuild);
  }

  private async handleAgregar(interaction: ChatInputCommandInteraction, guildId: string) {
    if (!this.requireAdmin(interaction)) {
      await interaction.reply({ content: 'Necesitas el permiso "Gestionar Servidor".', flags: MessageFlags.Ephemeral });
      return;
    }

    const role = interaction.options.getRole('rol', true);
    const categorySlug = interaction.options.getString('categoria', true);

    await this.categoryTags.addRoleDiscord(guildId, role.id, categorySlug);
    const category = await this.categories.findBySlug(categorySlug);
    await interaction.reply({
      content: `✅ ${roleMention(role.id)} será mencionado en anuncios de **${category!.displayName}**. Asegúrate de que el template incluya \`{{tags}}\`.`,
      flags: MessageFlags.Ephemeral,
    });
  }

  private async handleEliminar(interaction: ChatInputCommandInteraction, guildId: string) {
    if (!this.requireAdmin(interaction)) {
      await interaction.reply({ content: 'Necesitas el permiso "Gestionar Servidor".', flags: MessageFlags.Ephemeral });
      return;
    }

    const role = interaction.options.getRole('rol', true);
    const categorySlug = interaction.options.getString('categoria', true);

    await this.categoryTags.removeRoleDiscord(guildId, role.id, categorySlug);
    await interaction.reply({
      content: `✅ ${roleMention(role.id)} eliminado de las menciones de **${categorySlug}**.`,
      flags: MessageFlags.Ephemeral,
    });
  }

  private async handleLista(interaction: ChatInputCommandInteraction, guildId: string) {
    const categorySlug = interaction.options.getString('categoria');
    const allTags = await this.categoryTags.findByGuild(guildId);

    const tags = categorySlug
      ? allTags.filter(async (t) => {
          const cat = await this.categories.findById(t.categoryId);
          return cat?.slug === categorySlug;
        })
      : allTags;

    // Resolve category names for display
    const cats = await this.categories.findAll();
    const catMap = new Map(cats.map((c) => [c.id, c]));

    const filtered = categorySlug
      ? allTags.filter((t) => {
          const cat = catMap.get(t.categoryId);
          return cat?.slug === categorySlug;
        })
      : allTags;

    if (!filtered.length) {
      await interaction.reply({ content: 'No hay menciones configuradas en este servidor.', flags: MessageFlags.Ephemeral });
      return;
    }

    const embed = new EmbedBuilder().setTitle('Menciones activas').setColor(0xfee75c);

    const grouped = new Map<number, typeof filtered>();
    for (const tag of filtered) {
      const list = grouped.get(tag.categoryId) ?? [];
      list.push(tag);
      grouped.set(tag.categoryId, list);
    }

    for (const [categoryId, tagList] of grouped) {
      const cat = catMap.get(categoryId);
      const mentions = tagList
        .map((t) => (t.type === 'role' ? `${roleMention(t.targetId)} *(rol)*` : `${userMention(t.targetId)} *(usuario)*`))
        .join('\n');
      embed.addFields({ name: cat?.displayName ?? `Categoría #${categoryId}`, value: mentions, inline: false });
    }

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }
}
