import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateDomainEventOutbox1793817418067 implements MigrationInterface {
  name = 'CreateDomainEventOutbox1793817418067';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE "domain_event_outbox" (
        "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "event_key" varchar(300) NOT NULL UNIQUE,
        "event_type" varchar(100) NOT NULL,
        "aggregate_type" varchar(100) NOT NULL,
        "aggregate_id" varchar(100) NOT NULL,
        "payload" jsonb NOT NULL,
        "status" varchar(20) NOT NULL DEFAULT 'pending'
          CHECK ("status" IN ('pending', 'processing', 'completed', 'dead')),
        "attempts" integer NOT NULL DEFAULT 0 CHECK ("attempts" >= 0),
        "available_at" timestamptz NOT NULL DEFAULT now(),
        "locked_until" timestamptz NULL,
        "last_error" text NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "completed_at" timestamptz NULL
      )
    `);
    await queryRunner.query(`
      CREATE INDEX "domain_event_outbox_pending_idx"
      ON "domain_event_outbox" ("available_at", "created_at")
      WHERE "status" = 'pending'
    `);
    await queryRunner.query(`
      CREATE INDEX "domain_event_outbox_lease_idx"
      ON "domain_event_outbox" ("locked_until")
      WHERE "status" = 'processing'
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "domain_event_outbox"`);
  }
}
