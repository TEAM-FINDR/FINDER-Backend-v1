import { Inject, Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DomainEventPublisher } from '../events/domain-event.publisher';
import { DeadlineReminderPlanner } from './deadline-reminder.planner';
import { DeadlineReminderCandidate, DeadlineReminderSource } from './ports/deadline-reminder-source';

const POLL_INTERVAL_MS = 5 * 60_000;
const LOOKAHEAD_MS = 8 * 24 * 60 * 60_000;

@Injectable()
export class DeadlineReminderScheduler implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(DeadlineReminderScheduler.name);
  private timer?: NodeJS.Timeout;
  private activeCycle?: Promise<void>;

  constructor(
    private readonly config: ConfigService,
    private readonly planner: DeadlineReminderPlanner,
    private readonly events: DomainEventPublisher,
    @Optional() @Inject(DeadlineReminderSource) private readonly source?: DeadlineReminderSource,
  ) {}

  onApplicationBootstrap(): void {
    if (!this.source) {
      this.logger.warn('Deadline reminders are inactive until a candidate source is registered.');
      return;
    }
    this.timer = setInterval(() => void this.runCycle(), POLL_INTERVAL_MS);
    this.timer.unref();
    void this.runCycle();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    await this.activeCycle;
  }

  async planCandidates(candidates: DeadlineReminderCandidate[], now = new Date()): Promise<number> {
    const timeZone = this.config.getOrThrow<string>('APP_TIME_ZONE');
    let enqueued = 0;
    for (const candidate of candidates) {
      for (const event of this.planner.plan(candidate, now, timeZone)) {
        if (await this.events.publish(event)) enqueued += 1;
      }
    }
    return enqueued;
  }

  private runCycle(): Promise<void> {
    if (this.activeCycle || !this.source) return this.activeCycle ?? Promise.resolve();
    this.activeCycle = this.processCandidates()
      .catch((error: unknown) => {
        this.logger.error(`Deadline reminder planning failed: ${error instanceof Error ? error.name : 'UnknownError'}`);
      })
      .finally(() => { this.activeCycle = undefined; });
    return this.activeCycle;
  }

  private async processCandidates(): Promise<void> {
    const now = new Date();
    const candidates = await this.source!.findCandidates(now, new Date(now.getTime() + LOOKAHEAD_MS));
    const count = await this.planCandidates(candidates, now);
    if (count > 0) this.logger.log(`Enqueued ${count} deadline reminder event(s).`);
  }
}
