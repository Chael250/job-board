import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, Index } from 'typeorm';

@Entity('user_notification_preferences')
@Index(['userId'], { unique: true })
export class UserNotificationPreferences {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column('uuid')
  userId: string;

  @Column({ default: true })
  applicationStatusChanges: boolean;

  @Column({ default: true })
  newApplications: boolean;

  @Column({ default: true })
  jobPosted: boolean;

  @Column({ default: true })
  accountSuspended: boolean;

  @Column({ default: true })
  emailNotifications: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}