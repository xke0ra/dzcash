import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface EmailTemplate {
  subject: string;
  html: (vars: Record<string, string>) => string;
}

@Injectable()
export class EmailService {
  private transporter: any;

  constructor(private config: ConfigService) {
    if (this.isConfigured()) {
      // Lazy-init nodemailer when available
    }
  }

  isConfigured(): boolean {
    return !!(
      this.config.get('SMTP_HOST') &&
      this.config.get('SMTP_PORT') &&
      this.config.get('SMTP_USER') &&
      this.config.get('SMTP_PASS')
    );
  }

  private async getTransporter() {
    if (this.transporter) return this.transporter;
    const nodemailer = await import('nodemailer');
    this.transporter = nodemailer.default.createTransport({
      host: this.config.get('SMTP_HOST'),
      port: parseInt(this.config.get('SMTP_PORT') || '587'),
      secure: this.config.get('SMTP_SECURE') === 'true',
      auth: {
        user: this.config.get('SMTP_USER'),
        pass: this.config.get('SMTP_PASS'),
      },
    });
    return this.transporter;
  }

  async sendMail(options: EmailOptions): Promise<boolean> {
    if (!this.isConfigured()) {
      console.log(`[EmailService] SMTP not configured. Would send to ${options.to}: ${options.subject}`);
      return false;
    }
    try {
      const transporter = await this.getTransporter();
      await transporter.sendMail({
        from: `"${this.config.get('SMTP_FROM_NAME', 'DZCASH')}" <${this.config.get('SMTP_FROM', 'noreply@dzcash.com')}>`,
        ...options,
      });
      return true;
    } catch (err) {
      console.error(`[EmailService] Failed to send to ${options.to}:`, err);
      return false;
    }
  }

  sendVerificationEmail(to: string, code: string) {
    return this.sendMail({
      to,
      subject: 'Verify your email - DZCASH',
      html: this.templates.verification({ code }),
    });
  }

  sendWithdrawalApproved(to: string, amount: string, method: string) {
    return this.sendMail({
      to,
      subject: 'Withdrawal Approved - DZCASH',
      html: this.templates.withdrawalApproved({ amount, method }),
    });
  }

  sendWithdrawalRejected(to: string, amount: string, reason: string) {
    return this.sendMail({
      to,
      subject: 'Withdrawal Rejected - DZCASH',
      html: this.templates.withdrawalRejected({ amount, reason }),
    });
  }

  sendFraudAlert(to: string, trigger: string) {
    return this.sendMail({
      to,
      subject: 'Security Alert - DZCASH',
      html: this.templates.fraudAlert({ trigger }),
    });
  }

  sendWelcome(to: string) {
    return this.sendMail({
      to,
      subject: 'Welcome to DZCASH!',
      html: this.templates.welcome({}),
    });
  }

  private templates: Record<string, EmailTemplate> = {
    verification: {
      subject: 'Verify your email - DZCASH',
      html: ({ code }) => `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#0f172a;color:#f8fafc;padding:32px;border-radius:16px;border:1px solid #1e293b;">
          <div style="text-align:center;font-size:24px;font-weight:800;color:#38bdf8;margin-bottom:24px;">DZCASH</div>
          <h2 style="font-size:18px;margin:0 0 12px;">Verify Your Email</h2>
          <p style="font-size:14px;color:#94a3b8;margin:0 0 20px;">Use the code below to verify your email address:</p>
          <div style="text-align:center;font-size:32px;font-weight:800;color:#38bdf8;letter-spacing:8px;background:#1e293b;padding:16px;border-radius:12px;margin:0 0 20px;">${code}</div>
          <p style="font-size:12px;color:#64748b;">This code expires in 1 hour.</p>
        </div>`,
    },
    withdrawalApproved: {
      subject: 'Withdrawal Approved - DZCASH',
      html: ({ amount, method }) => `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#0f172a;color:#f8fafc;padding:32px;border-radius:16px;border:1px solid #1e293b;">
          <div style="text-align:center;font-size:24px;font-weight:800;color:#38bdf8;margin-bottom:24px;">DZCASH</div>
          <h2 style="font-size:18px;margin:0 0 12px;">Withdrawal Approved! 🎉</h2>
          <p style="font-size:14px;color:#94a3b8;margin:0 0 20px;">Your withdrawal has been approved and is being processed.</p>
          <div style="background:#1e293b;padding:16px;border-radius:12px;margin:0 0 20px;">
            <p style="font-size:12px;color:#64748b;margin:0 0 4px;">Amount</p>
            <p style="font-size:20px;font-weight:800;color:#34d399;margin:0 0 12px;">$${amount}</p>
            <p style="font-size:12px;color:#64748b;margin:0 0 4px;">Method</p>
            <p style="font-size:14px;color:#f8fafc;margin:0;">${method}</p>
          </div>
          <p style="font-size:12px;color:#64748b;">Funds should arrive within 24-48 hours.</p>
        </div>`,
    },
    withdrawalRejected: {
      subject: 'Withdrawal Rejected - DZCASH',
      html: ({ amount, reason }) => `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#0f172a;color:#f8fafc;padding:32px;border-radius:16px;border:1px solid #1e293b;">
          <div style="text-align:center;font-size:24px;font-weight:800;color:#38bdf8;margin-bottom:24px;">DZCASH</div>
          <h2 style="font-size:18px;margin:0 0 12px;color:#f43f5e;">Withdrawal Rejected</h2>
          <div style="background:#1e293b;padding:16px;border-radius:12px;margin:0 0 20px;">
            <p style="font-size:12px;color:#64748b;margin:0 0 4px;">Amount</p>
            <p style="font-size:20px;font-weight:800;color:#f43f5e;margin:0 0 12px;">$${amount}</p>
            <p style="font-size:12px;color:#64748b;margin:0 0 4px;">Reason</p>
            <p style="font-size:14px;color:#f8fafc;margin:0;">${reason}</p>
          </div>
          <p style="font-size:12px;color:#64748b;">Contact support if you have questions.</p>
        </div>`,
    },
    fraudAlert: {
      subject: 'Security Alert - DZCASH',
      html: ({ trigger }) => `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#0f172a;color:#f8fafc;padding:32px;border-radius:16px;border:1px solid #1e293b;">
          <div style="text-align:center;font-size:24px;font-weight:800;color:#38bdf8;margin-bottom:24px;">DZCASH</div>
          <h2 style="font-size:18px;margin:0 0 12px;color:#f43f5e;">Security Alert</h2>
          <p style="font-size:14px;color:#94a3b8;margin:0 0 20px;">We detected unusual activity on your account:</p>
          <div style="background:#1e293b;padding:12px 16px;border-radius:8px;margin:0 0 20px;font-size:13px;color:#f8fafc;">
            ${trigger}
          </div>
          <p style="font-size:12px;color:#64748b;">If this was you, no action needed. Otherwise, contact support immediately.</p>
        </div>`,
    },
    welcome: {
      subject: 'Welcome to DZCASH!',
      html: () => `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;background:#0f172a;color:#f8fafc;padding:32px;border-radius:16px;border:1px solid #1e293b;">
          <div style="text-align:center;font-size:24px;font-weight:800;color:#38bdf8;margin-bottom:24px;">DZCASH</div>
          <h2 style="font-size:18px;margin:0 0 12px;">Welcome! 🎉</h2>
          <p style="font-size:14px;color:#94a3b8;margin:0 0 20px;">Start completing offers and earning rewards today!</p>
          <a href="https://dzcash.com/offers" style="display:inline-block;background:#38bdf8;color:#0f172a;font-weight:700;padding:12px 24px;border-radius:8px;text-decoration:none;font-size:14px;">Browse Offers</a>
        </div>`,
    },
  };
}
