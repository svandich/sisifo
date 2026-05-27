import { Injectable } from '@nestjs/common';
import { Contest, ContestFilter, IContestProvider } from './providers/contest-provider.interface';
import { CodeforcesProvider } from './providers/codeforces.provider';
import { AtCoderProvider } from './providers/atcoder.provider';

@Injectable()
export class ContestsService {
  private readonly providers = new Map<string, IContestProvider>();

  constructor(
    private readonly codeforces: CodeforcesProvider,
    private readonly atcoder: AtCoderProvider,
  ) {
    this.providers.set(codeforces.platform, codeforces);
    this.providers.set(atcoder.platform, atcoder);
  }

  getProvider(platform: string): IContestProvider {
    const provider = this.providers.get(platform);
    if (!provider) throw new Error(`Unknown platform: ${platform}`);
    return provider;
  }

  getPlatformNames(): string[] {
    return Array.from(this.providers.keys());
  }

  async fetchContests(platform: string, filter?: ContestFilter): Promise<Contest[]> {
    return this.getProvider(platform).fetchContests(filter);
  }

  async getContestById(platform: string, externalId: string): Promise<Contest | null> {
    return this.getProvider(platform).getContestById(externalId);
  }
}
