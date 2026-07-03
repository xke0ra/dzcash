import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as path from 'path';
import * as fs from 'fs';

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

@Injectable()
export class EmailService {
  private transporter: any;
  private handlebars: any;
  private layoutTemplate: HandlebarsTemplate | null = null;
  private templatesCache = new Map<string, HandlebarsTemplate>();

  constructor(private config: ConfigService) {}

  isConfigured(): boolean {
    return !!(
      this.config.get('SMTP_HOST') &&
      this.config.get('SMTP_PORT') &&
      this.config.get('SMTP_USER') &&
      this.config.get('SMTP_PASS')
    );
  }

  private async getHandlebars(): Promise<any> {
    if (!this.handlebars) {
      this.handlebars = await import('handlebars');
      this.handlebars.registerHelper('json', (ctx: any) => JSON.stringify(ctx));
    }
    return this.handlebars;
  }

  private async loadTemplate(name: string): Promise<HandlebarsTemplate> {
    const cached = this.templatesCache.get(name);
    if (cached) return cached;

    const hbs = await this.getHandlebars();
    const filePath = path.join(__dirname, 'templates', `${name}.hbs`);
    const source = fs.readFileSync(filePath, 'utf-8');
    const template = hbs.compile(source);
    this.templatesCache.set(name, template);
    return template;
  }

  private async render(name: string, vars: Record<string, any>): Promise<string> {
    const hbs = await this.getHandlebars();
    if (!this.layoutTemplate) {
      const layoutPath = path.join(__dirname, 'templates', 'layout.hbs');
      const layoutSource = fs.readFileSync(layoutPath, 'utf-8');
      this.layoutTemplate = hbs.compile(layoutSource);
    }

    const body = await this.loadTemplate(name);
    const bodyHtml = body({ ...vars, year: new Date().getFullYear() });
    return this.layoutTemplate!({ body: bodyHtml, year: new Date().getFullYear() });
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
    return this.render('verification', { code }).then((html) =>
      this.sendMail({ to, subject: 'Verify your email - DZCASH', html }),
    );
  }

  sendWithdrawalApproved(to: string, amount: string, method: string) {
    return this.render('withdrawal-approved', { amount, method }).then((html) =>
      this.sendMail({ to, subject: 'Withdrawal Approved - DZCASH', html }),
    );
  }

  sendWithdrawalRejected(to: string, amount: string, reason: string) {
    return this.render('withdrawal-rejected', { amount, reason }).then((html) =>
      this.sendMail({ to, subject: 'Withdrawal Rejected - DZCASH', html }),
    );
  }

  sendFraudAlert(to: string, trigger: string) {
    return this.render('fraud-alert', { trigger }).then((html) =>
      this.sendMail({ to, subject: 'Security Alert - DZCASH', html }),
    );
  }

  sendWelcome(to: string) {
    return this.render('welcome', {}).then((html) =>
      this.sendMail({ to, subject: 'Welcome to DZCASH!', html }),
    );
  }
}

type HandlebarsTemplate = (vars: Record<string, any>) => string;
