export interface Contest {
  externalId: string;
  platform: string;
  name: string;
  url: string;
  startTime: Date;
  durationSeconds: number;
  phase: ContestPhase;
}

export type ContestPhase = 'UPCOMING' | 'ONGOING' | 'FINISHED';

export interface ContestFilter {
  query?: string;
  phase?: ContestPhase;
}

export interface IContestProvider {
  readonly platform: string;
  fetchContests(filter?: ContestFilter): Promise<Contest[]>;
  getContestById(externalId: string): Promise<Contest | null>;
}
