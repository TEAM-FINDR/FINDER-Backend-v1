import { DomainEventEntity } from '../entities/domain-event.entity';
import { NewDomainEvent } from '../domain-event.types';

export abstract class EventOutboxRepository {
  abstract enqueue(event: NewDomainEvent): Promise<boolean>;
  abstract claim(limit: number, now: Date, leaseMs: number): Promise<DomainEventEntity[]>;
  abstract complete(eventId: string, at: Date): Promise<void>;
  abstract fail(eventId: string, attempts: number, maxAttempts: number, retryAt: Date, reason: string): Promise<void>;
}
