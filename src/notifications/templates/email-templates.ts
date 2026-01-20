import { EmailTemplate } from '../interfaces/notification.interface';

export const EMAIL_TEMPLATES: Record<string, EmailTemplate> = {
  application_status_change: {
    subject: 'Application Status Update - {{jobTitle}}',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Application Status Update</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
          .content { padding: 20px 0; }
          .status { font-weight: bold; color: #007bff; text-transform: capitalize; }
          .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 14px; color: #666; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Application Status Update</h1>
        </div>
        <div class="content">
          <p>Dear {{jobSeekerName}},</p>
          <p>We wanted to update you on the status of your application for the position of <strong>{{jobTitle}}</strong> at <strong>{{companyName}}</strong>.</p>
          <p>Your application status has been updated to: <span class="status">{{status}}</span></p>
          <p>Application submitted on: {{applicationDate}}</p>
          <p>Thank you for your interest in this position. We appreciate the time you took to apply.</p>
        </div>
        <div class="footer">
          <p>Best regards,<br>The Job Board Team</p>
          <p><small>This is an automated message. Please do not reply to this email.</small></p>
        </div>
      </body>
      </html>
    `,
    text: `
Dear {{jobSeekerName}},

We wanted to update you on the status of your application for the position of {{jobTitle}} at {{companyName}}.

Your application status has been updated to: {{status}}
Application submitted on: {{applicationDate}}

Thank you for your interest in this position. We appreciate the time you took to apply.

Best regards,
The Job Board Team

This is an automated message. Please do not reply to this email.
    `,
  },

  new_application: {
    subject: 'New Application Received - {{jobTitle}}',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>New Application Received</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
          .content { padding: 20px 0; }
          .highlight { background-color: #e7f3ff; padding: 15px; border-radius: 5px; margin: 15px 0; }
          .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 14px; color: #666; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>New Application Received</h1>
        </div>
        <div class="content">
          <p>Dear {{companyName}} Team,</p>
          <p>You have received a new application for your job posting:</p>
          <div class="highlight">
            <p><strong>Position:</strong> {{jobTitle}}</p>
            <p><strong>Applicant:</strong> {{applicantName}}</p>
            <p><strong>Application Date:</strong> {{applicationDate}}</p>
            <p><strong>Resume Attached:</strong> {{resumeAttached}}</p>
          </div>
          <p>Please log in to your dashboard to review the application and take appropriate action.</p>
        </div>
        <div class="footer">
          <p>Best regards,<br>The Job Board Team</p>
          <p><small>This is an automated message. Please do not reply to this email.</small></p>
        </div>
      </body>
      </html>
    `,
    text: `
Dear {{companyName}} Team,

You have received a new application for your job posting:

Position: {{jobTitle}}
Applicant: {{applicantName}}
Application Date: {{applicationDate}}
Resume Attached: {{resumeAttached}}

Please log in to your dashboard to review the application and take appropriate action.

Best regards,
The Job Board Team

This is an automated message. Please do not reply to this email.
    `,
  },

  job_posted: {
    subject: 'Job Successfully Posted - {{jobTitle}}',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Job Successfully Posted</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
          .content { padding: 20px 0; }
          .success { background-color: #d4edda; color: #155724; padding: 15px; border-radius: 5px; margin: 15px 0; }
          .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 14px; color: #666; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Job Successfully Posted</h1>
        </div>
        <div class="content">
          <p>Dear {{companyName}} Team,</p>
          <div class="success">
            <p>Your job posting for <strong>{{jobTitle}}</strong> has been successfully published and is now live on our platform.</p>
          </div>
          <p>Job seekers can now view and apply for this position. You will receive notifications when applications are submitted.</p>
          <p>You can manage your job postings and review applications through your company dashboard.</p>
        </div>
        <div class="footer">
          <p>Best regards,<br>The Job Board Team</p>
        </div>
      </body>
      </html>
    `,
    text: `
Dear {{companyName}} Team,

Your job posting for {{jobTitle}} has been successfully published and is now live on our platform.

Job seekers can now view and apply for this position. You will receive notifications when applications are submitted.

You can manage your job postings and review applications through your company dashboard.

Best regards,
The Job Board Team
    `,
  },

  account_suspended: {
    subject: 'Account Suspended - Job Board',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Account Suspended</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
          .content { padding: 20px 0; }
          .warning { background-color: #fff3cd; color: #856404; padding: 15px; border-radius: 5px; margin: 15px 0; }
          .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; font-size: 14px; color: #666; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Account Suspended</h1>
        </div>
        <div class="content">
          <p>Dear {{userName}},</p>
          <div class="warning">
            <p>Your account has been suspended due to a violation of our terms of service.</p>
          </div>
          <p>Reason: {{reason}}</p>
          <p>If you believe this suspension was made in error, please contact our support team for assistance.</p>
          <p>During the suspension period, you will not be able to access your account or use our services.</p>
        </div>
        <div class="footer">
          <p>Best regards,<br>The Job Board Team</p>
        </div>
      </body>
      </html>
    `,
    text: `
Dear {{userName}},

Your account has been suspended due to a violation of our terms of service.

Reason: {{reason}}

If you believe this suspension was made in error, please contact our support team for assistance.

During the suspension period, you will not be able to access your account or use our services.

Best regards,
The Job Board Team
    `,
  },
};