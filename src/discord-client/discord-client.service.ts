import { Injectable } from '@nestjs/common';
import { Client } from 'discord.js';

@Injectable()
export class DiscordClientService {
  private client?: Client;

  set(client: Client) {
    this.client = client;
  }

  get(): Client | undefined {
    return this.client;
  }
}
