import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { DomainEventEntity } from '../../events/entities/domain-event.entity';
import { EventOutboxRepository } from '../../events/ports/event-outbox.repository';
import { NewDomainEvent } from '../../events/domain-event.types';

@Injectable()
export class TypeOrmEventOutboxRepository extends EventOutboxRepository {
  constructor(
    private readonly dataSource: DataSource,
    @InjectRepository(DomainEventEntity) private readonly events: Repository<DomainEventEntity>,
  ) { super(); }

  enqueue(event: NewDomainEvent): Promise<boolean> {
    return this.dataSource.transaction((manager) => this.enqueueInTransaction(manager, event));
  }

  async enqueueInTransaction(manager: EntityManager, event: NewDomainEvent): Promise<boolean> {
    const result = await manager.query(
      `INSERT INTO "domain_event_outbox" ("event_key", "event_type", "aggregate_type", "aggregate_id", "payload", "available_at")
       VALUES ($1, $2, $3, $4, $5::jsonb, COALESCE($6, now()))
       ON CONFLICT ("event_key") DO NOTHING
       RETURNING "id"`,
      [event.eventKey, event.eventType, event.aggregateType, event.aggregateId, JSON.stringify(event.payload), event.availableAt ?? null],
    ) as Array<{ id: string }>;
    return result.length === 1;
  }

  async claim(limit: number, now: Date, leaseMs: number): Promise<DomainEventEntity[]> {
    return this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(DomainEventEntity);
      const events = await repository.createQueryBuilder('event')
        .setLock('pessimistic_write')
        .setOnLocked('skip_locked')
        .where("(event.status = 'pending' AND event.available_at <= :now)", { now })
        .orWhere("(event.status = 'processing' AND event.locked_until <= :now)", { now })
        .orderBy('event.available_at', 'ASC')
        .addOrderBy('event.created_at', 'ASC')
        .take(limit)
        .getMany();

      const lockedUntil = new Date(now.getTime() + leaseMs);
      for (const event of events) {
        event.status = 'processing';
        event.attempts += 1;
        event.lockedUntil = lockedUntil;
        await repository.save(event);
      }
      return events;
    });
  }

  async complete(eventId: string, at: Date) {
    await this.events.update({ id: eventId, status: 'processing' }, {
      status: 'completed',
      completedAt: at,
      lockedUntil: null,
      lastError: null,
    });
  }

  async fail(eventId: string, attempts: number, maxAttempts: number, retryAt: Date, reason: string) {
    await this.events.update({ id: eventId, status: 'processing' }, {
      status: attempts >= maxAttempts ? 'dead' : 'pending',
      availableAt: retryAt,
      lockedUntil: null,
      lastError: reason.slice(0, 4000),
    });
  }
}
