import { DomainEventEntity } from './entities/domain-event.entity';
import { DomainEventType } from './domain-event.types';

export interface DomainEventHandler {
  readonly eventTypes: readonly DomainEventType[];
  handle(event: DomainEventEntity): Promise<void>;
}
