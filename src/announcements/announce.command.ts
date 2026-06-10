import { Injectable } from '@nestjs/common';
import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  MessageFlags,
  PermissionsBitField,
  SlashCommandBuilder,
} from 'discord.js';
import { ISlashCommand } from '../bot/slash-command.interface';
import { AnnouncementsService } from './announcements.service';
import { ContestsService } from '../contests/contests.service';
import { TemplatesService } from '../templates/templates.service';
import { CategoriesService } from '../categories/categories.service';
import { formatDate } from '../common/format.util';
import { parseWhen } from '../common/parse-when.util';

const FIVE_MINUTES = 5 * 60 * 1000;
const THIRTY_MINUTES = 30 * 60 * 1000;

@Injectable()
export class AnnounceCommand implements ISlashCommand {
  constructor(
    private readonly announcements: AnnouncementsService,
    private readonly contests: ContestsService,
    private readonly templates: TemplatesService,
    private readonly categories: CategoriesService,
  ) {}

  readonly data = new SlashCommandBuilder()
    .setName('anunciar')
    .setDescription('Programar anuncios de concursos')
    .addSubcommand((sub) =>
      sub
        .setName('programar')
        .setDescription('Programar un anuncio de concurso para una categoría')
        .addStringOption((o) =>
          o
            .setName('plataforma')
            .setDescription('Plataforma del concurso')
            .setRequired(true)
            .addChoices({ name: 'Codeforces', value: 'codeforces' }, { name: 'AtCoder', value: 'atcoder' }),
        )
        .addStringOption((o) =>
          o.setName('id_concurso').setDescription('ID del concurso (obtenido con /concurso proximos)').setRequired(true),
        )
        .addStringOption((o) =>
          o.setName('categoria').setDescription('Slug de la categoría (usa /categoria lista)').setRequired(true),
        )
        .addStringOption((o) =>
          o
            .setName('cuando')
            .setDescription('Cuándo enviar (concursos) o inicio de simulación. ISO/relativo. Defecto: 30m antes.')
            .setRequired(false),
        )
        .addStringOption((o) =>
          o.setName('plantilla').setDescription('Nombre de plantilla (deja vacío para usar la predeterminada)').setRequired(false),
        ),
    )
    .addSubcommand((sub) => sub.setName('lista').setDescription('Ver anuncios pendientes de este servidor'))
    .addSubcommand((sub) =>
      sub
        .setName('cancelar')
        .setDescription('Cancelar un anuncio pendiente')
        .addIntegerOption((o) => o.setName('id').setDescription('ID del anuncio').setRequired(true)),
    );

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const guildId = interaction.guildId;
    if (!guildId) {
      await interaction.reply({ content: 'Este comando solo puede usarse dentro de un servidor.', flags: MessageFlags.Ephemeral });
      return;
    }

    const sub = interaction.options.getSubcommand();
    try {
      if (sub === 'programar') await this.handleProgramar(interaction, guildId);
      else if (sub === 'lista') await this.handleLista(interaction, guildId);
      else if (sub === 'cancelar') await this.handleCancelar(interaction, guildId);
    } catch (err) {
      const msg = `Error: ${err.message}`;
      if (interaction.deferred || interaction.replied) await interaction.editReply(msg);
      else await interaction.reply({ content: msg, flags: MessageFlags.Ephemeral });
    }
  }

  private async handleProgramar(interaction: ChatInputCommandInteraction, guildId: string) {
    if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.ManageGuild)) {
      await interaction.reply({ content: 'Necesitas el permiso "Gestionar Servidor".', flags: MessageFlags.Ephemeral });
      return;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const platform = interaction.options.getString('plataforma', true);
    const contestId = interaction.options.getString('id_concurso', true);
    const categorySlug = interaction.options.getString('categoria', true);
    const cuandoStr = interaction.options.getString('cuando');
    const templateName = interaction.options.getString('plantilla') ?? undefined;

    const contest = await this.contests.getContestById(platform, contestId);
    if (!contest) {
      await interaction.editReply(`No se encontró el concurso \`${contestId}\` en ${platform}.`);
      return;
    }

    const category = await this.categories.findBySlug(categorySlug);
    if (!category) {
      await interaction.editReply(`Categoría \`${categorySlug}\` no encontrada. Usa \`/categoria lista\` para ver las disponibles.`);
      return;
    }

    if (templateName) {
      try {
        await this.templates.findOne(guildId, templateName);
      } catch {
        await interaction.editReply(`Plantilla "${templateName}" no encontrada. Usa \`/plantilla lista\` para ver las disponibles.`);
        return;
      }
    }

    let scheduledFor: Date;
    let simulationStartTime: Date | undefined;

    if (category.type === 'simulacion') {
      // `cuando` = simulation start time; announcement fires 5min before
      if (!cuandoStr) {
        await interaction.editReply(
          'Las simulaciones requieren el parámetro `cuando` con la hora de inicio de la simulación (ej: `18:00`, `2024-06-01T18:00:00Z` o `2h`).',
        );
        return;
      }
      const simStart = parseWhen(cuandoStr);
      if (!simStart) {
        await interaction.editReply('Formato de tiempo inválido. Usa hora (`18:00`), ISO 8601 (`2024-06-01T18:00:00Z`) o relativo (`2h`, `30m`).');
        return;
      }
      simulationStartTime = simStart;
      scheduledFor = new Date(simStart.getTime() - FIVE_MINUTES);
    } else {
      if (cuandoStr) {
        const parsed = parseWhen(cuandoStr);
        if (!parsed) {
          await interaction.editReply('Formato de tiempo inválido. Usa hora (`18:00`), ISO 8601 (`2024-06-01T18:00:00Z`) o relativo (`30m`, `2h`, `1d`).');
          return;
        }
        if (contest.phase !== 'UPCOMING') {
          // VP contest: `cuando` = the VP time; announce 5min before so participants are ready
          simulationStartTime = parsed;
          scheduledFor = new Date(parsed.getTime() - FIVE_MINUTES);
        } else {
          scheduledFor = parsed;
        }
      } else if (contest.phase === 'UPCOMING') {
        scheduledFor = new Date(contest.startTime.getTime() - THIRTY_MINUTES);
      } else {
        await interaction.editReply(
          `El concurso **${contest.name}** ya comenzó. Debes especificar el parámetro \`cuando\` para indicar cuándo enviar el anuncio.`,
        );
        return;
      }
    }

    if (scheduledFor <= new Date()) {
      await interaction.editReply('La hora programada ya pasó. Especifica un tiempo en el futuro.');
      return;
    }

    const announcement = await this.announcements.schedule({
      scheduledByGuildId: guildId,
      categorySlug,
      contestPlatform: platform,
      contestExternalId: contestId,
      contestName: contest.name,
      contestUrl: contest.url,
      contestStartTime: contest.startTime,
      contestDurationSeconds: contest.durationSeconds,
      templateName,
      scheduledFor,
      simulationStartTime,
    });

    const sendLabel = formatDate(scheduledFor);
    const simLabel = simulationStartTime
      ? `\n${category.type === 'simulacion' ? 'Inicio de simulación' : 'Virtual Participation'}: **${formatDate(simulationStartTime)}**`
      : '';
    await interaction.editReply(
      `✅ Anuncio **#${announcement.id}** programado para **${sendLabel}**.${simLabel}\nConcurso: **${contest.name}** → Categoría: **${category.displayName}**`,
    );
  }

  private async handleLista(interaction: ChatInputCommandInteraction, guildId: string) {
    const pending = await this.announcements.listPending(guildId);

    if (!pending.length) {
      await interaction.reply({ content: 'No hay anuncios pendientes.', flags: MessageFlags.Ephemeral });
      return;
    }

    const cats = await this.categories.findAll();
    const catMap = new Map(cats.map((c) => [c.id, c]));

    const embed = new EmbedBuilder().setTitle('Anuncios pendientes').setColor(0xed4245);

    const isAdmin = interaction.memberPermissions?.has(PermissionsBitField.Flags.ManageGuild) ?? false;

    for (const a of pending) {
      const cat = catMap.get(a.categoryId);
      const isSimulacion = cat?.type === 'simulacion';
      const contestLabel = isSimulacion && !isAdmin ? '???' : (a.contestName ?? `${a.contestPlatform} / ${a.contestExternalId}`);
      embed.addFields({
        name: `#${a.id} — ${contestLabel}`,
        value: `Categoría: **${cat?.displayName ?? a.categoryId}**\nEnvío: ${formatDate(a.scheduledFor)}${a.templateName ? `\nPlantilla: ${a.templateName}` : ''}`,
      });
    }

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  }

  private async handleCancelar(interaction: ChatInputCommandInteraction, guildId: string) {
    if (!interaction.memberPermissions?.has(PermissionsBitField.Flags.ManageGuild)) {
      await interaction.reply({ content: 'Necesitas el permiso "Gestionar Servidor".', flags: MessageFlags.Ephemeral });
      return;
    }

    const id = interaction.options.getInteger('id', true);
    await this.announcements.cancel(guildId, id);
    await interaction.reply({ content: `✅ Anuncio **#${id}** cancelado.`, flags: MessageFlags.Ephemeral });
  }
}
