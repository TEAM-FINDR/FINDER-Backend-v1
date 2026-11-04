export interface DeadlineReminderCandidate {
  userId: string;
  opportunityId: string;
  deadlineAt: Date;
  pushEnabled: boolean;
  activeDeviceCount: number;
  emailEnabled: boolean;
  emailVerified: boolean;
}

export abstract class DeadlineReminderSource {
  abstract findCandidates(from: Date, until: Date): Promise<DeadlineReminderCandidate[]>;
}
