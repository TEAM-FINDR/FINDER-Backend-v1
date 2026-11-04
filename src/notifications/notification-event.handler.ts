import { Inject, Injectable, Logger, OnModuleInit, Optional } from '@nestjs/common';
import { DomainEventHandler } from '../events/domain-event-handler';
import { DomainEventEntity } from '../events/entities/domain-event.entity';
import { DomainEventType } from '../events/domain-event.types';
import { EventHandlerRegistry } from '../events/event-handler.registry';
import { NotificationDeliveryPort } from './ports/notification-delivery.port';

@Injectable()
export class NotificationEventHandler implements DomainEventHandler, OnModuleInit {
  readonly eventTypes = [DomainEventType.NOTIFICATION_REQUESTED, DomainEventType.DEADLINE_REMINDER] as const;
  private readonly logger = new Logger(NotificationEventHandler.name);

  constructor(
    private readonly registry: EventHandlerRegistry,
    @Optional() @Inject(NotificationDeliveryPort) private readonly delivery?: NotificationDeliveryPort,
  ) {}

  onModuleInit(): void {
    if (!this.delivery) {
      this.logger.warn('Notification events are inactive until a delivery adapter is registered.');
      return;
    }
    this.registry.register(this);
  }

  handle(event: DomainEventEntity): Promise<void> {
    if (!this.delivery) throw new Error('Notification delivery adapter is unavailable.');
    return this.delivery.deliver(event);
  }
}
