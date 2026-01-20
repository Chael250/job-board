import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum EmploymentType {
  FULL_TIME = 'full_time',
  PART_TIME = 'part_time',
  CONTRACT = 'contract',
  INTERNSHIP = 'internship',
}

@Entity('jobs')
export class Job {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 255 })
  title: string;

  @Column('text')
  description: string;

  @Column('text', { nullable: true })
  requirements: string;

  @Column({ length: 255 })
  location: string;

  @Column({
    name: 'employment_type',
    type: 'enum',
    enum: EmploymentType,
  })
  employmentType: EmploymentType;

  @Column({ name: 'salary_min', type: 'integer', nullable: true })
  salaryMin: number;

  @Column({ name: 'salary_max', type: 'integer', nullable: true })
  salaryMax: number;

  @Column({ name: 'salary_currency', length: 3, default: 'USD' })
  salaryCurrency: string;

  @Column({ name: 'company_id' })
  companyId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'company_id' })
  company: User;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @Column({ name: 'closed_at', type: 'timestamp', nullable: true })
  closedAt: Date;
}