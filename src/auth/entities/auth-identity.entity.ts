import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'auth_identities' })
@Index('auth_identities_provider_subject_unique', ['provider', 'providerSubject'], { unique: true })
export class AuthIdentityEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({ type: 'varchar', length: 20 })
  provider!: string;

  @Column({ name: 'provider_subject', type: 'varchar', length: 255 })
  providerSubject!: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
