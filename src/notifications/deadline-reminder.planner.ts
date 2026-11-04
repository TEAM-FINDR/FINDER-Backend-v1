import { Injectable } from '@nestjs/common';
import { DomainEventType, NewDomainEvent } from '../events/domain-event.types';
import { DeadlineReminderCandidate } from './ports/deadline-reminder-source';

const REMINDER_OFFSETS = [7, 3, 1] as const;

@Injectable()
export class DeadlineReminderPlanner {
  plan(
    candidate: DeadlineReminderCandidate,
    now: Date,
    timeZone: string,
  ): NewDomainEvent[] {
    const channels = [
      ...(candidate.pushEnabled && candidate.activeDeviceCount > 0 ? ['push'] : []),
      ...(candidate.emailEnabled && candidate.emailVerified ? ['email'] : []),
    ];
    if (channels.length === 0 || candidate.deadlineAt <= now) return [];

    const deadlineDate = zonedDateParts(candidate.deadlineAt, timeZone);
    const today = dateKey(zonedDateParts(now, timeZone));
    const deadlineKey = candidate.deadlineAt.toISOString();
    const events: NewDomainEvent[] = [];

    for (const daysBefore of REMINDER_OFFSETS) {
      const sendDate = addCalendarDays(deadlineDate, -daysBefore);
      if (dateKey(sendDate) !== today) continue;
      const availableAt = zonedDateTime(sendDate, 9, 0, timeZone);
      if (availableAt > now) continue;
      events.push({
        eventKey: `deadline:${candidate.userId}:${candidate.opportunityId}:${deadlineKey}:${daysBefore}`,
        eventType: DomainEventType.DEADLINE_REMINDER,
        aggregateType: 'opportunity',
        aggregateId: candidate.opportunityId,
        availableAt,
        payload: {
          userId: candidate.userId,
          opportunityId: candidate.opportunityId,
          deadlineAt: deadlineKey,
          daysBefore,
          channels,
        },
      });
    }
    return events;
  }
}

interface ZonedDateParts { year: number; month: number; day: number }

function zonedDateParts(date: Date, timeZone: string): ZonedDateParts {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  return {
    year: Number(parts.find((part) => part.type === 'year')?.value),
    month: Number(parts.find((part) => part.type === 'month')?.value),
    day: Number(parts.find((part) => part.type === 'day')?.value),
  };
}

function addCalendarDays(date: ZonedDateParts, amount: number): ZonedDateParts {
  const shifted = new Date(Date.UTC(date.year, date.month - 1, date.day + amount));
  return { year: shifted.getUTCFullYear(), month: shifted.getUTCMonth() + 1, day: shifted.getUTCDate() };
}

function dateKey(date: ZonedDateParts): string {
  return `${date.year}-${String(date.month).padStart(2, '0')}-${String(date.day).padStart(2, '0')}`;
}

function zonedDateTime(date: ZonedDateParts, hour: number, minute: number, timeZone: string): Date {
  const intendedUtc = Date.UTC(date.year, date.month - 1, date.day, hour, minute);
  let candidateUtc = intendedUtc;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const actual = zonedDateTimeParts(new Date(candidateUtc), timeZone);
    const actualAsUtc = Date.UTC(actual.year, actual.month - 1, actual.day, actual.hour, actual.minute);
    candidateUtc += intendedUtc - actualAsUtc;
  }
  return new Date(candidateUtc);
}

function zonedDateTimeParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  return {
    year: Number(parts.find((part) => part.type === 'year')?.value),
    month: Number(parts.find((part) => part.type === 'month')?.value),
    day: Number(parts.find((part) => part.type === 'day')?.value),
    hour: Number(parts.find((part) => part.type === 'hour')?.value),
    minute: Number(parts.find((part) => part.type === 'minute')?.value),
  };
}
