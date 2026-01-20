export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

export interface NotificationData {
  to: string;
  template: string;
  data: Record<string, any>;
}

export interface NotificationLog {
  id: string;
  to: string;
  template: string;
  status: 'pending' | 'sent' | 'failed' | 'retrying';
  attempts: number;
  lastAttempt?: Date;
  sentAt?: Date;
  error?: string;
  createdAt: Date;
}

export enum NotificationType {
  APPLICATION_STATUS_CHANGE = 'application_status_change',
  NEW_APPLICATION = 'new_application',
  JOB_POSTED = 'job_posted',
  ACCOUNT_SUSPENDED = 'account_suspended',
}

export interface ApplicationStatusChangeData {
  jobSeekerName: string;
  jobTitle: string;
  companyName: string;
  status: string;
  applicationDate: string;
}

export interface NewApplicationData {
  companyName: string;
  jobTitle: string;
  applicantName: string;
  applicationDate: string;
  resumeAttached: boolean;
}