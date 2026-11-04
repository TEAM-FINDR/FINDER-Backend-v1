import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'auth_challenges' })
@Index('auth_challenges_email_purpose_idx', ['email', 'purpose'])
export class AuthChallengeEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId!: string | null;

  @Column({ type: 'varchar', length: 320 })
  email!: string;

  @Column({ type: 'varchar', length: 30 })
  purpose!: string;

  @Column({ name: 'token_hash', type: 'varchar', length: 64 })
  tokenHash!: string;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ name: 'consumed_at', type: 'timestamptz', nullable: true })
  consumedAt!: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
