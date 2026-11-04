import { DomainEventEntity } from '../entities/domain-event.entity';
import { NewDomainEvent } from '../domain-event.types';

export abstract class EventOutboxRepository {
  abstract enqueue(event: NewDomainEvent): Promise<boolean>;
  abstract claim(limit: number, now: Date, leaseMs: number, eventTypes: readonly string[]): Promise<DomainEventEntity[]>;
  abstract complete(eventId: string, leaseToken: string, at: Date): Promise<void>;
  abstract fail(eventId: string, leaseToken: string, attempts: number, maxAttempts: number, retryAt: Date, reason: string): Promise<void>;
}
