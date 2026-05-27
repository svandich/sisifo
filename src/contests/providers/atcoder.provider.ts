import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { Contest, ContestFilter, ContestPhase, IContestProvider } from './contest-provider.interface';

interface AtCoderContest {
  id: string;
  start_epoch_second: number;
  duration_second: number;
  title: string;
  rate_change: string;
}

@Injectable()
export class AtCoderProvider implements IContestProvider {
  readonly platform = 'atcoder';
  private readonly baseUrl = 'https://kenkoooo.com/atcoder/resources';

  async fetchContests(filter?: ContestFilter): Promise<Contest[]> {
    const { data } = await axios.get<AtCoderContest[]>(`${this.baseUrl}/contests.json`);

    let contests = data.map((c) => this.mapContest(c));

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

  private mapContest(c: AtCoderContest): Contest {
    const now = Date.now();
    const start = c.start_epoch_second * 1000;
    const end = start + c.duration_second * 1000;

    return {
      externalId: c.id,
      platform: this.platform,
      name: c.title,
      url: `https://atcoder.jp/contests/${c.id}`,
      startTime: new Date(start),
      durationSeconds: c.duration_second,
      phase: this.resolvePhase(now, start, end),
    };
  }

  private resolvePhase(now: number, start: number, end: number): ContestPhase {
    if (now < start) return 'UPCOMING';
    if (now < end) return 'ONGOING';
    return 'FINISHED';
  }
}
