import { Inject, Injectable } from '@nestjs/common';
import { NewDomainEvent } from './domain-event.types';
import { EventOutboxRepository } from './ports/event-outbox.repository';

@Injectable()
export class DomainEventPublisher {
  constructor(
    @Inject(EventOutboxRepository)
    private readonly outbox: EventOutboxRepository,
  ) {}

  publish(event: NewDomainEvent): Promise<boolean> {
    return this.outbox.enqueue(event);
  }
}
