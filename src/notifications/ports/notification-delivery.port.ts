import { DomainEventEntity } from '../../events/entities/domain-event.entity';

export abstract class NotificationDeliveryPort {
  /** Re-check current settings/devices, persist the inbox item once, then dispatch enabled channels. */
  abstract deliver(event: DomainEventEntity): Promise<void>;
}
