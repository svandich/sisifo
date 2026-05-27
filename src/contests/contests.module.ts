import { Module } from '@nestjs/common';
import { ContestsService } from './contests.service';
import { ContestCommand } from './contest.command';
import { CodeforcesProvider } from './providers/codeforces.provider';
import { AtCoderProvider } from './providers/atcoder.provider';

@Module({
  providers: [ContestsService, ContestCommand, CodeforcesProvider, AtCoderProvider],
  exports: [ContestsService, ContestCommand],
})
export class ContestsModule {}
