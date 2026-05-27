import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { Contest, ContestFilter, ContestPhase, IContestProvider } from './contest-provider.interface';

interface CfContest {
  id: number;
  name: string;
  type: string;
  phase: string;
  durationSeconds: number;
  startTimeSeconds: number;
}

@Injectable()
export class CodeforcesProvider implements IContestProvider {
  readonly platform = 'codeforces';
  private readonly logger = new Logger(CodeforcesProvider.name);
  private readonly baseUrl = 'https://codeforces.com/api';

  async fetchContests(filter?: ContestFilter): Promise<Contest[]> {
    const { data } = await axios.get<{ status: string; result: CfContest[] }>(
      `${this.baseUrl}/contest.list?gym=false`,
    );

    if (data.status !== 'OK') throw new Error('Codeforces API error');

    let contests = data.result.map((c) => this.mapContest(c));

    if (filter?.phase) {
      contests = contests.filter((c) => c.phase === filter.phase);
    }

    if (filter?.query) {
      const q = filter.query.toLowerCase();
      contests = contests.filter((c) => c.name.toLowerCase().includes(q));
    }

    return contests;
  }

  async getContestById(externalId: string): Promise<Contest | null> {
    const contests = await this.fetchContests();
    return contests.find((c) => c.externalId === externalId) ?? null;
  }

  private mapContest(c: CfContest): Contest {
    return {
      externalId: String(c.id),
      platform: this.platform,
      name: c.name,
      url: `https://codeforces.com/contest/${c.id}`,
      startTime: new Date(c.startTimeSeconds * 1000),
      durationSeconds: c.durationSeconds,
      phase: this.mapPhase(c.phase),
    };
  }

  private mapPhase(phase: string): ContestPhase {
    if (phase === 'BEFORE') return 'UPCOMING';
    if (phase === 'CODING') return 'ONGOING';
    return 'FINISHED';
  }
}
