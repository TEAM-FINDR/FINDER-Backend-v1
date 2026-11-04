import { Injectable } from '@nestjs/common';
import { DomainEventEntity } from './entities/domain-event.entity';
import { DomainEventHandler } from './domain-event-handler';

@Injectable()
export class EventHandlerRegistry {
  private readonly handlers = new Map<string, DomainEventHandler>();

  register(handler: DomainEventHandler): void {
    for (const eventType of handler.eventTypes) {
      if (this.handlers.has(eventType)) {
        throw new Error(`A handler is already registered for event type: ${eventType}`);
      }
      this.handlers.set(eventType, handler);
    }
  }

  async dispatch(event: DomainEventEntity): Promise<void> {
    const handler = this.handlers.get(event.eventType);
    if (!handler) throw new Error(`No handler registered for event type: ${event.eventType}`);
    await handler.handle(event);
  }
}
