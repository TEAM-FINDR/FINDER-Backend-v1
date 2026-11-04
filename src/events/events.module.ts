import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DomainEventEntity } from './entities/domain-event.entity';
import { DomainEventPublisher } from './domain-event.publisher';
import { EventOutboxRepository } from './ports/event-outbox.repository';
import { TypeOrmEventOutboxRepository } from '../database/repositories/typeorm-event-outbox.repository';
import { EventHandlerRegistry } from './event-handler.registry';
import { OutboxWorkerService } from './outbox-worker.service';

@Module({
  imports: [TypeOrmModule.forFeature([DomainEventEntity])],
  providers: [
    DomainEventPublisher,
    EventHandlerRegistry,
    OutboxWorkerService,
    { provide: EventOutboxRepository, useClass: TypeOrmEventOutboxRepository },
  ],
  exports: [DomainEventPublisher, EventHandlerRegistry, EventOutboxRepository],
})
export class EventsModule {}
