import { Injectable } from '@nestjs/common';
import {
  ChannelType,
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  PermissionsBitField,
  SlashCommandBuilder,
  channelMention,
} from 'discord.js';
import { ISlashCommand } from '../bot/slash-command.interface';
import { SubscriptionsService } from './subscriptions.service';
import { CategoriesService } from '../categories/categories.service';

@Injectable()
export class SubscribeCommand implements ISlashCommand {
  constructor(
    private readonly subscriptions: SubscriptionsService,
    private readonly categories: CategoriesService,
  ) {}

  readonly data = new SlashCommandBuilder()
    .setName('suscripcion')
    .setDescription('Gestionar suscripciones de canales a categorías de anuncios')
    .addSubcommand((sub) =>
      sub
        .setName('agregar')
        .setDescription('Suscribir un canal a una categoría')
        .addStringOption((o) =>
          o.setName('categoria').setDescription('Slug de la categoría (usa /categoria lista para ver los slugs)').setRequired(true),
        )
        .addChannelOption((o) =>
          o
            .setName('canal')
            .setDescription('Canal a suscribir (deja vacío para usar el canal actual)')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(false),
        )
        .addBooleanOption((o) =>
          o
            .setName('admin')
            .setDescription('Canal de admin: recibe el concurso completo en simulaciones (defecto: no)')
            .setRequired(false),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('eliminar')
        .setDescription('Desuscribir un canal de una categoría')
        .addStringOption((o) => o.setName('categoria').setDescription('Slug de la categoría').setRequired(true))
        .addChannelOption((o) =>
          o
            .setName('canal')
            .setDescription('Canal a desuscribir (deja vacío para usar el canal actual)')
            .addChannelTypes(ChannelType.GuildText)
            .setRequired(false),
        )
        .addBooleanOption((o) =>
          o
            .setName('admin')
            .setDescription('Desuscribir la suscripción de admin (defecto: no)')
            .setRequired(false),
        ),
    )
    .addSubcommand((sub) =>
      sub.setName('lista').setDescription('Ver los canales suscritos en este servidor'),
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

    const categorySlug = interaction.options.getString('categoria', true);
    const channel = interaction.options.getChannel('canal') ?? interaction.channel;
    const adminOnly = interaction.options.getBoolean('admin') ?? false;
    if (!channel) {
      await interaction.reply({ content: 'No se pudo determinar el canal.', flags: MessageFlags.Ephemeral });
      return;
    }

    await this.subscriptions.subscribeDiscord(guildId, channel.id, categorySlug, adminOnly);
    const category = await this.categories.findBySlug(categorySlug);
    const adminLabel = adminOnly ? ' *(admin — verá detalles completos de simulaciones)*' : '';
    await interaction.reply({
      content: `✅ ${channelMention(channel.id)} suscrito a **${category!.displayName}**.${adminLabel}`,
      flags: MessageFlags.Ephemeral,
    });
  }

  private async handleEliminar(interaction: ChatInputCommandInteraction, guildId: string) {
    if (!this.requireAdmin(interaction)) {
      await interaction.reply({ content: 'Necesitas el permiso "Gestionar Servidor".', flags: MessageFlags.Ephemeral });
      return;
    }

    const categorySlug = interaction.options.getString('categoria', true);
    const channel = interaction.options.getChannel('canal') ?? interaction.channel;
    const adminOnly = interaction.options.getBoolean('admin') ?? false;
    if (!channel) {
      await interaction.reply({ content: 'No se pudo determinar el canal.', flags: MessageFlags.Ephemeral });
      return;
    }

    await this.subscriptions.unsubscribeDiscord(channel.id, categorySlug, adminOnly);
    await interaction.reply({
      content: `✅ ${channelMention(channel.id)} desuscrito.`,
      flags: MessageFlags.Ephemeral,
    });
  }

  private async handleLista(interaction: ChatInputCommandInteraction, guildId: string) {
    const subs = await this.subscriptions.findByGuild(guildId);

    if (!subs.length) {
      await interaction.reply({ content: 'Este servidor no tiene suscripciones activas.', flags: MessageFlags.Ephemeral });
      return;
    }

    const cats = await this.categories.findAll();
    const catMap = new Map(cats.map((c) => [c.id, c]));

    const embed = new EmbedBuilder().setTitle('Suscripciones activas').setColor(0x5865f2);
    for (const sub of subs) {
      const cat = catMap.get(sub.categoryId);
      embed.addFields({
        name: cat?.displayName ?? `Categoría #${sub.categoryId}`,
        value: `${channelMention(sub.chatId)}${sub.adminOnly ? ' *(admin)*' : ''}`,
        inline: true,
      });
    }

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }
}
