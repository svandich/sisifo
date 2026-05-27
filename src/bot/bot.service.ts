import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  Client,
  GatewayIntentBits,
  MessageFlags,
  REST,
  Routes,
  ChatInputCommandInteraction,
  Interaction,
} from 'discord.js';
import { ISlashCommand } from './slash-command.interface';
import { TemplateCommand } from '../templates/template.command';
import { ContestCommand } from '../contests/contest.command';
import { AnnounceCommand } from '../announcements/announce.command';
import { CategoryCommand } from '../categories/category.command';
import { SubscribeCommand } from '../subscriptions/subscribe.command';
import { SuscribirmeCommand } from '../category-tags/suscribirme.command';
import { TagsCommand } from '../category-tags/tags.command';
import { AnnouncementsService } from '../announcements/announcements.service';

@Injectable()
export class BotService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BotService.name);
  private readonly client: Client;
  private readonly commands = new Map<string, ISlashCommand>();

  constructor(
    private readonly config: ConfigService,
    private readonly templateCommand: TemplateCommand,
    private readonly contestCommand: ContestCommand,
    private readonly announceCommand: AnnounceCommand,
    private readonly categoryCommand: CategoryCommand,
    private readonly subscribeCommand: SubscribeCommand,
    private readonly suscribirmeCommand: SuscribirmeCommand,
    private readonly tagsCommand: TagsCommand,
    private readonly announcementsService: AnnouncementsService,
  ) {
    this.client = new Client({ intents: [GatewayIntentBits.Guilds] });
    this.registerCommand(templateCommand);
    this.registerCommand(contestCommand);
    this.registerCommand(announceCommand);
    this.registerCommand(categoryCommand);
    this.registerCommand(subscribeCommand);
    this.registerCommand(suscribirmeCommand);
    this.registerCommand(tagsCommand);
  }

  private registerCommand(cmd: ISlashCommand) {
    this.commands.set(cmd.data.name, cmd);
  }

  async onModuleInit() {
    this.announcementsService.setDiscordClient(this.client);

    this.client.once('clientReady', async (c) => {
      this.logger.log(`Conectado como ${c.user.tag}`);
      await this.deployCommands(c.user.id);
    });

    this.client.on('interactionCreate', (interaction: Interaction) => {
      if (interaction.isChatInputCommand()) {
        this.handleCommand(interaction).catch((err) =>
          this.logger.error(`Error no controlado en comando: ${err.message}`),
        );
      }
    });

    const token = this.config.getOrThrow<string>('DISCORD_TOKEN');
    await this.client.login(token);
  }

  async onModuleDestroy() {
    this.client.destroy();
  }

  private async deployCommands(clientId: string) {
    const token = this.config.getOrThrow<string>('DISCORD_TOKEN');
    const commandData = Array.from(this.commands.values()).map((c) => c.data.toJSON());

    const rest = new REST().setToken(token);
    await rest.put(Routes.applicationCommands(clientId), { body: commandData });

    this.logger.log(`${commandData.length} comandos registrados`);
  }

  private async handleCommand(interaction: ChatInputCommandInteraction) {
    const command = this.commands.get(interaction.commandName);
    if (!command) return;

    try {
      await command.execute(interaction);
    } catch (err) {
      this.logger.error(`Error en /${interaction.commandName}: ${err.message}`);
      const msg = 'Ocurrió un error al ejecutar este comando.';
      if (interaction.replied || interaction.deferred) {
        await interaction.editReply(msg);
      } else {
        await interaction.reply({ content: msg, flags: MessageFlags.Ephemeral });
      }
    }
  }
}
