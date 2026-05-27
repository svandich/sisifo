import { Injectable } from '@nestjs/common';
import { ChatInputCommandInteraction, EmbedBuilder, MessageFlags, SlashCommandBuilder } from 'discord.js';
import { ISlashCommand } from '../bot/slash-command.interface';
import { TemplatesService } from './templates.service';

@Injectable()
export class TemplateCommand implements ISlashCommand {
  constructor(private readonly templates: TemplatesService) {}

  readonly data = new SlashCommandBuilder()
    .setName('template')
    .setDescription('Manage announcement message templates')
    .addSubcommand((sub) =>
      sub
        .setName('create')
        .setDescription('Create a new template')
        .addStringOption((o) => o.setName('name').setDescription('Template name').setRequired(true))
        .addStringOption((o) =>
          o
            .setName('content')
            .setDescription('Template content. Use {{contest_name}}, {{platform}}, {{start_time}}, {{duration}}, {{contest_url}}')
            .setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('edit')
        .setDescription('Edit an existing template')
        .addStringOption((o) => o.setName('name').setDescription('Template name').setRequired(true))
        .addStringOption((o) => o.setName('content').setDescription('New content').setRequired(true)),
    )
    .addSubcommand((sub) =>
      sub
        .setName('list')
        .setDescription('List all templates for this server'),
    )
    .addSubcommand((sub) =>
      sub
        .setName('view')
        .setDescription('View a template')
        .addStringOption((o) => o.setName('name').setDescription('Template name').setRequired(true)),
    )
    .addSubcommand((sub) =>
      sub
        .setName('delete')
        .setDescription('Delete a template')
        .addStringOption((o) => o.setName('name').setDescription('Template name').setRequired(true)),
    )
    .addSubcommand((sub) =>
      sub
        .setName('variables')
        .setDescription('Show available template variables'),
    );

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const guildId = interaction.guildId;
    if (!guildId) {
      await interaction.reply({ content: 'This command can only be used in a server.', flags: MessageFlags.Ephemeral });
      return;
    }

    const sub = interaction.options.getSubcommand();

    try {
      if (sub === 'create') await this.handleCreate(interaction, guildId);
      else if (sub === 'edit') await this.handleEdit(interaction, guildId);
      else if (sub === 'list') await this.handleList(interaction, guildId);
      else if (sub === 'view') await this.handleView(interaction, guildId);
      else if (sub === 'delete') await this.handleDelete(interaction, guildId);
      else if (sub === 'variables') await this.handleVariables(interaction);
    } catch (err) {
      const msg = `Error: ${err.message}`;
      if (interaction.deferred) await interaction.editReply(msg);
      else await interaction.reply({ content: msg, flags: MessageFlags.Ephemeral });
    }
  }

  private async handleCreate(interaction: ChatInputCommandInteraction, guildId: string) {
    const name = interaction.options.getString('name', true);
    const content = interaction.options.getString('content', true);
    await this.templates.create(guildId, name, content);
    await interaction.reply({ content: `Template **${name}** created successfully.`, flags: MessageFlags.Ephemeral });
  }

  private async handleEdit(interaction: ChatInputCommandInteraction, guildId: string) {
    const name = interaction.options.getString('name', true);
    const content = interaction.options.getString('content', true);
    await this.templates.update(guildId, name, content);
    await interaction.reply({ content: `Template **${name}** updated.`, flags: MessageFlags.Ephemeral });
  }

  private async handleList(interaction: ChatInputCommandInteraction, guildId: string) {
    const templates = await this.templates.findAll(guildId);

    if (!templates.length) {
      await interaction.reply({ content: 'No templates yet. Use `/template create` to make one.', flags: MessageFlags.Ephemeral });
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle('Message Templates')
      .setColor(0x57f287)
      .setDescription(templates.map((t) => `**${t.name}**`).join('\n'));

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }

  private async handleView(interaction: ChatInputCommandInteraction, guildId: string) {
    const name = interaction.options.getString('name', true);
    const template = await this.templates.findOne(guildId, name);

    const embed = new EmbedBuilder()
      .setTitle(`Template: ${template.name}`)
      .setColor(0x57f287)
      .setDescription(`\`\`\`\n${template.content}\n\`\`\``);

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }

  private async handleDelete(interaction: ChatInputCommandInteraction, guildId: string) {
    const name = interaction.options.getString('name', true);
    await this.templates.delete(guildId, name);
    await interaction.reply({ content: `Template **${name}** deleted.`, flags: MessageFlags.Ephemeral });
  }

  private async handleVariables(interaction: ChatInputCommandInteraction) {
    const embed = new EmbedBuilder()
      .setTitle('Available Template Variables')
      .setColor(0xfee75c)
      .addFields(
        { name: '{{contest_name}}', value: 'Name of the contest', inline: false },
        { name: '{{platform}}', value: 'Codeforces / AtCoder', inline: false },
        { name: '{{start_time}}', value: 'Formatted start date and time (UTC)', inline: false },
        { name: '{{duration}}', value: 'Contest duration (e.g. 2h 30m)', inline: false },
        { name: '{{contest_url}}', value: 'Direct link to the contest page', inline: false },
        { name: '{{tags}}', value: 'Mentions of users/roles subscribed to be tagged for this category (empty string if none)', inline: false },
      );

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }
}
