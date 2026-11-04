import { Inject, Injectable, Logger, OnModuleInit, Optional } from '@nestjs/common';
import { DomainEventHandler } from '../events/domain-event-handler';
import { DomainEventEntity } from '../events/entities/domain-event.entity';
import { DomainEventType, NewDomainEvent } from '../events/domain-event.types';
import { DomainEventPublisher } from '../events/domain-event.publisher';
import { EventHandlerRegistry } from '../events/event-handler.registry';
import { EligibilityRecalculationPort } from './ports/eligibility-recalculation.port';

@Injectable()
export class EligibilityRecalculationHandler implements DomainEventHandler, OnModuleInit {
  readonly eventTypes = [DomainEventType.PROFILE_CHANGED, DomainEventType.OPPORTUNITY_CHANGED] as const;
  private readonly logger = new Logger(EligibilityRecalculationHandler.name);

  constructor(
    private readonly registry: EventHandlerRegistry,
    @Optional() @Inject(EligibilityRecalculationPort) private readonly recalculation?: EligibilityRecalculationPort,
  ) {}

  onModuleInit(): void {
    if (!this.recalculation) {
      this.logger.warn('Eligibility change handlers are inactive until a recalculation adapter is registered.');
      return;
    }
    this.registry.register(this);
  }

  handle(event: DomainEventEntity): Promise<void> {
    if (!this.recalculation) throw new Error('Eligibility recalculation adapter is unavailable.');
    if (event.eventType === DomainEventType.PROFILE_CHANGED) {
      return this.recalculation.fromProfileChange(event);
    }
    if (event.eventType === DomainEventType.OPPORTUNITY_CHANGED) {
      return this.recalculation.fromOpportunityChange(event);
    }
    throw new Error(`Unsupported eligibility source event: ${event.eventType}`);
  }
}

@Injectable()
export class EligibilityNotificationEventHandler implements DomainEventHandler, OnModuleInit {
  readonly eventTypes = [DomainEventType.ELIGIBILITY_CHANGED] as const;

  constructor(
    private readonly registry: EventHandlerRegistry,
    private readonly events: DomainEventPublisher,
  ) {}

  onModuleInit(): void { this.registry.register(this); }

  async handle(event: DomainEventEntity): Promise<void> {
    const { userId, opportunityId, previousStatus, currentStatus, revision } = event.payload;
    if (typeof userId !== 'string' || typeof opportunityId !== 'string' || typeof revision !== 'string') {
      throw new Error('Eligibility change event is missing its user, opportunity, or revision key.');
    }
    if (typeof previousStatus !== 'string' || typeof currentStatus !== 'string') {
      throw new Error('Eligibility change event is missing previous or current status.');
    }
    if (previousStatus === currentStatus) return;

    const notification: NewDomainEvent = {
      eventKey: `notification:eligibility:${userId}:${opportunityId}:${revision}`,
      eventType: DomainEventType.NOTIFICATION_REQUESTED,
      aggregateType: 'user',
      aggregateId: userId,
      payload: {
        userId,
        opportunityId,
        notificationType: 'ELIGIBILITY_CHANGED',
        previousStatus,
        currentStatus,
        revision,
        sourceEventKey: event.eventKey,
      },
    };
    await this.events.publish(notification);
  }
}
