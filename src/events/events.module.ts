import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DomainEventEntity } from './entities/domain-event.entity';
import { DomainEventPublisher } from './domain-event.publisher';
import { EventOutboxRepository } from './ports/event-outbox.repository';
import { TypeOrmEventOutboxRepository } from '../database/repositories/typeorm-event-outbox.repository';

@Module({
  imports: [TypeOrmModule.forFeature([DomainEventEntity])],
  providers: [
    DomainEventPublisher,
    { provide: EventOutboxRepository, useClass: TypeOrmEventOutboxRepository },
  ],
  exports: [DomainEventPublisher],
})
export class EventsModule {}
