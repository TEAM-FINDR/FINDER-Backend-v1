export const DomainEventType = {
  PROFILE_CHANGED: 'profile.changed',
  OPPORTUNITY_CHANGED: 'opportunity.changed',
  ELIGIBILITY_CHANGED: 'eligibility.changed',
  NOTIFICATION_REQUESTED: 'notification.requested',
  DEADLINE_REMINDER: 'deadline.reminder',
} as const;

export type DomainEventType = (typeof DomainEventType)[keyof typeof DomainEventType];

export interface NewDomainEvent {
  eventKey: string;
  eventType: DomainEventType;
  aggregateType: string;
  aggregateId: string;
  payload: Record<string, unknown>;
  availableAt?: Date;
}

export interface DomainEventRecord extends NewDomainEvent {
  id: string;
  attempts: number;
  createdAt: Date;
}
