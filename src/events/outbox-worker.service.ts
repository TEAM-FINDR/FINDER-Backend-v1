import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { EventOutboxRepository } from './ports/event-outbox.repository';
import { EventHandlerRegistry } from './event-handler.registry';

const POLL_INTERVAL_MS = 1_000;
const BATCH_SIZE = 20;
const LEASE_MS = 60_000;
const MAX_ATTEMPTS = 8;
const RETRY_BASE_MS = 1_000;
const RETRY_MAX_MS = 30 * 60_000;

@Injectable()
export class OutboxWorkerService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(OutboxWorkerService.name);
  private timer?: NodeJS.Timeout;
  private activeCycle?: Promise<void>;

  constructor(
    @Inject(EventOutboxRepository) private readonly outbox: EventOutboxRepository,
    private readonly handlers: EventHandlerRegistry,
  ) {}

  onApplicationBootstrap(): void {
    this.timer = setInterval(() => void this.runCycle(), POLL_INTERVAL_MS);
    this.timer.unref();
    void this.runCycle();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    await this.activeCycle;
  }

  private runCycle(): Promise<void> {
    if (this.activeCycle) return this.activeCycle;
    this.activeCycle = this.processBatch()
      .catch((error: unknown) => {
        this.logger.error(JSON.stringify({ event: 'outbox_poll_failed', error: this.errorName(error) }));
      })
      .finally(() => { this.activeCycle = undefined; });
    return this.activeCycle;
  }

  private async processBatch(): Promise<void> {
    const events = await this.outbox.claim(BATCH_SIZE, new Date(), LEASE_MS);
    for (const event of events) {
      try {
        await this.handlers.dispatch(event);
        if (event.leaseToken) await this.outbox.complete(event.id, event.leaseToken, new Date());
      } catch (error) {
        const retryAt = this.retryAt(event.attempts);
        if (event.leaseToken) await this.outbox.fail(event.id, event.leaseToken, event.attempts, MAX_ATTEMPTS, retryAt, this.errorSummary(error));
        this.logger.warn(JSON.stringify({
          event: 'outbox_handler_failed',
          eventId: event.id,
          eventType: event.eventType,
          attempt: event.attempts,
          retryAt: event.attempts >= MAX_ATTEMPTS ? null : retryAt.toISOString(),
          dead: event.attempts >= MAX_ATTEMPTS,
          error: this.errorName(error),
        }));
      }
    }
  }

  private retryAt(attempt: number): Date {
    const delay = Math.min(RETRY_BASE_MS * 2 ** Math.max(0, attempt - 1), RETRY_MAX_MS);
    return new Date(Date.now() + delay);
  }

  private errorName(error: unknown): string {
    return error instanceof Error ? error.name.slice(0, 100) : 'UnknownError';
  }

  private errorSummary(error: unknown): string {
    if (!(error instanceof Error)) return 'Unknown event processing error';
    return `${error.name}: ${error.message}`
      .replace(/Bearer\s+\S+/gi, 'Bearer [REDACTED]')
      .replace(/(token|password|secret|api[_-]?key)=([^\s&]+)/gi, '$1=[REDACTED]')
      .slice(0, 4_000);
  }
}
