import { ChannelType } from 'discord.js';
import { Controller, Get, UseGuards } from '@nestjs/common';
import { AdminAuthGuard } from './admin-auth.guard';
import { DiscordClientService } from '../discord-client/discord-client.service';

interface GuildInfo {
  id: string;
  name: string;
  channels: { id: string; name: string }[];
  roles: { id: string; name: string }[];
}

@Controller('discord')
@UseGuards(AdminAuthGuard)
export class DiscordController {
  constructor(private readonly discordClient: DiscordClientService) {}

  @Get('guilds')
  async guilds(): Promise<GuildInfo[]> {
    const client = this.discordClient.get();
    if (!client?.isReady()) return [];

    const guilds: GuildInfo[] = [];
    for (const guild of client.guilds.cache.values()) {
      const channels = await guild.channels.fetch();
      const roles = await guild.roles.fetch();
      guilds.push({
        id: guild.id,
        name: guild.name,
        channels: channels
          .filter((c) => c?.type === ChannelType.GuildText)
          .map((c) => ({ id: c!.id, name: c!.name })),
        roles: roles.filter((r) => !r.managed && r.id !== guild.id).map((r) => ({ id: r.id, name: r.name })),
      });
    }
    return guilds;
  }
}
