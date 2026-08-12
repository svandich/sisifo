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
import { ContestCommand } from '../contests/contest.command';
import { SuscribirmeCommand } from '../category-tags/suscribirme.command';
import { SubscribeCommand } from '../subscriptions/subscribe.command';
import { DiscordClientService } from '../discord-client/discord-client.service';

@Injectable()
export class BotService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BotService.name);
  private readonly client: Client;
  private readonly commands = new Map<string, ISlashCommand>();

  constructor(
    private readonly config: ConfigService,
    private readonly contestCommand: ContestCommand,
    private readonly suscribirmeCommand: SuscribirmeCommand,
    private readonly subscribeCommand: SubscribeCommand,
    private readonly discordClientService: DiscordClientService,
  ) {
    this.client = new Client({ intents: [GatewayIntentBits.Guilds] });
    this.registerCommand(contestCommand);
    this.registerCommand(suscribirmeCommand);
    this.registerCommand(subscribeCommand);
  }

  private registerCommand(cmd: ISlashCommand) {
    this.commands.set(cmd.data.name, cmd);
  }

  async onModuleInit() {
    this.discordClientService.set(this.client);

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
