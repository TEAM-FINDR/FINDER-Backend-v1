import { DomainEventEntity } from '../../events/entities/domain-event.entity';

export abstract class EligibilityRecalculationPort {
  /** Persist recalculations and enqueue changed-state events in the same transaction. */
  abstract fromProfileChange(event: DomainEventEntity): Promise<void>;
  /** Persist recalculations and enqueue changed-state events in the same transaction. */
  abstract fromOpportunityChange(event: DomainEventEntity): Promise<void>;
}
