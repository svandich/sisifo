import { Injectable } from '@nestjs/common';
import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
} from 'discord.js';
import { ISlashCommand } from '../bot/slash-command.interface';
import { ContestsService } from './contests.service';
import { Contest } from './providers/contest-provider.interface';
import { formatDuration, formatDate } from '../common/format.util';

const PAGE_SIZE = 5;

@Injectable()
export class ContestCommand implements ISlashCommand {
  constructor(private readonly contests: ContestsService) {}

  readonly data = new SlashCommandBuilder()
    .setName('contest')
    .setDescription('Browse competitive programming contests')
    .addSubcommand((sub) =>
      sub
        .setName('upcoming')
        .setDescription('List upcoming contests')
        .addStringOption((o) =>
          o
            .setName('platform')
            .setDescription('Platform to search')
            .setRequired(true)
            .addChoices({ name: 'Codeforces', value: 'codeforces' }, { name: 'AtCoder', value: 'atcoder' }),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('search')
        .setDescription('Search contests by name')
        .addStringOption((o) =>
          o
            .setName('platform')
            .setDescription('Platform to search')
            .setRequired(true)
            .addChoices({ name: 'Codeforces', value: 'codeforces' }, { name: 'AtCoder', value: 'atcoder' }),
        )
        .addStringOption((o) => o.setName('query').setDescription('Search term').setRequired(true)),
    )
    .addSubcommand((sub) =>
      sub
        .setName('info')
        .setDescription('Get details for a specific contest')
        .addStringOption((o) =>
          o
            .setName('platform')
            .setDescription('Platform')
            .setRequired(true)
            .addChoices({ name: 'Codeforces', value: 'codeforces' }, { name: 'AtCoder', value: 'atcoder' }),
        )
        .addStringOption((o) => o.setName('id').setDescription('Contest ID').setRequired(true)),
    );

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply();
    const sub = interaction.options.getSubcommand();

    try {
      if (sub === 'upcoming') await this.handleUpcoming(interaction);
      else if (sub === 'search') await this.handleSearch(interaction);
      else if (sub === 'info') await this.handleInfo(interaction);
    } catch (err) {
      await interaction.editReply(`Error fetching contests: ${err.message}`);
    }
  }

  private async handleUpcoming(interaction: ChatInputCommandInteraction) {
    const platform = interaction.options.getString('platform', true);
    const list = await this.contests.fetchContests(platform, { phase: 'UPCOMING' });

    if (!list.length) {
      await interaction.editReply(`No upcoming contests found on ${platform}.`);
      return;
    }

    const embed = this.buildListEmbed(`Upcoming ${platform} contests`, list.slice(0, PAGE_SIZE));
    await interaction.editReply({ embeds: [embed] });
  }

  private async handleSearch(interaction: ChatInputCommandInteraction) {
    const platform = interaction.options.getString('platform', true);
    const query = interaction.options.getString('query', true);
    const list = await this.contests.fetchContests(platform, { query });

    if (!list.length) {
      await interaction.editReply(`No contests matching "${query}" on ${platform}.`);
      return;
    }

    const embed = this.buildListEmbed(`Search results on ${platform}`, list.slice(0, PAGE_SIZE));
    await interaction.editReply({ embeds: [embed] });
  }

  private async handleInfo(interaction: ChatInputCommandInteraction) {
    const platform = interaction.options.getString('platform', true);
    const id = interaction.options.getString('id', true);
    const contest = await this.contests.getContestById(platform, id);

    if (!contest) {
      await interaction.editReply(`Contest \`${id}\` not found on ${platform}.`);
      return;
    }

    const embed = this.buildDetailEmbed(contest);
    await interaction.editReply({ embeds: [embed] });
  }

  private buildListEmbed(title: string, contests: Contest[]): EmbedBuilder {
    const embed = new EmbedBuilder().setTitle(title).setColor(0x5865f2);

    for (const c of contests) {
      embed.addFields({
        name: c.name,
        value: `ID: \`${c.externalId}\` | Starts: ${formatDate(c.startTime)} | Duration: ${formatDuration(c.durationSeconds)}\n[Link](${c.url})`,
      });
    }

    return embed;
  }

  private buildDetailEmbed(c: Contest): EmbedBuilder {
    return new EmbedBuilder()
      .setTitle(c.name)
      .setURL(c.url)
      .setColor(0x5865f2)
      .addFields(
        { name: 'Platform', value: c.platform, inline: true },
        { name: 'ID', value: c.externalId, inline: true },
        { name: 'Phase', value: c.phase, inline: true },
        { name: 'Start Time', value: formatDate(c.startTime), inline: true },
        { name: 'Duration', value: formatDuration(c.durationSeconds), inline: true },
      );
  }
}
