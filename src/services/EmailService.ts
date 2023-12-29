import { Mail, Response } from '@sendgrid/helpers/classes';
import { EmailData } from '@sendgrid/helpers/classes/email-address';
import sendgrid from '@sendgrid/mail';
import config from '../config';

const sendGridJson = config.sendGrid;

export interface IEmailService {
  sendResetPasswordEmail(to: EmailData, token: string): Promise<void>;
  sendConfirmationEmail(to: EmailData, token: string): Promise<void>;
  sendEmail(mail: Mail): Promise<void>;
  errorHtml(errorMessage: string): string;
}

class EmailService implements IEmailService {
  private readonly CANNOT_SEND_MAIL = 'Could not send mail';
  private readonly EMAIL_SENT_CODE = 202;

  constructor() {
    sendgrid.setApiKey(sendGridJson.apiKey);
  }

  /**
   *
   * @param {Mail} mail Sendgrid mail object
   * @returns {Result} Result.error if there is something wrong
   */
  public async sendEmail(mail: any | Mail): Promise<void> {
    try {
      const sgResult = await sendgrid.send(mail);
      if (sgResult) {
        const error = sgResult.find(
          (x) => x instanceof Response && x.statusCode !== this.EMAIL_SENT_CODE
        );
        if (error) {
          console.error(JSON.stringify(error));
          throw new Error(this.CANNOT_SEND_MAIL);
        }
      }
    } catch (err) {
      throw err;
    }
  }

  /**
   * Sends confirmation email to a user
   * @param to
   * @param token
   */
  public async sendConfirmationEmail(
    to: EmailData,
    token: string
  ): Promise<void> {
    if (typeof to === 'string') {
      to = { email: to };
    }

    const mail = new Mail({
      to,
      from: sendGridJson.email.noReply,
      subject: sendGridJson.confirmation.subject,
      templateId: sendGridJson.confirmation.template,
      dynamicTemplateData: {
        header_message: sendGridJson.confirmation.headerMessage,
        company_name: config.company,
        btn_message: sendGridJson.confirmation.btnMessage,
        btn_link: `${config.frontEndDomain}${sendGridJson.confirmation.btnLink}${token}`
      }
    });

    await this.sendEmail(mail);
  }

  /**
   * Sends reset password email to a user
   * @param to
   * @param token
   */
  public async sendResetPasswordEmail(
    to: EmailData,
    token: string
  ): Promise<void> {
    if (typeof to === 'string') {
      to = { email: to };
    }

    const mail = new Mail({
      to,
      from: sendGridJson.email.noReply,
      subject: sendGridJson.resetPassword.subject,
      templateId: sendGridJson.resetPassword.template,
      dynamicTemplateData: {
        header_message: sendGridJson.resetPassword.headerMessage,
        company_name: config.company,
        btn_message: sendGridJson.resetPassword.btnMessage,
        btn_link: `${config.frontEndDomain}${sendGridJson.resetPassword.btnLink}${token}`
      }
    });

    await this.sendEmail(mail);
  }

  public async sendAlertEmail(
    to: EmailData,
    alert: string,
    body: string
  ): Promise<void> {
    if (typeof to === 'string') {
      to = { email: to };
    }

    const mail = new Mail({
      to,
      from: sendGridJson.email.noReply,
      subject: sendGridJson.alert.subject,
      templateId: sendGridJson.alert.template,
      dynamicTemplateData: {
        alert,
        body,
        company_name: config.company
      }
    });

    await this.sendEmail(mail);
  }

  public async sendNotificationEmail(
    to: EmailData,
    title: string,
    header: string,
    body: string
  ): Promise<void> {
    if (typeof to === 'string') {
      to = { email: to };
    }

    const mail = new Mail({
      to,
      from: sendGridJson.email.noReply,
      subject: sendGridJson.notification.subject,
      templateId: sendGridJson.notification.template,
      dynamicTemplateData: {
        title,
        header,
        body,
        company_name: config.company
      }
    });

    await this.sendEmail(mail);
  }

  public errorHtml(errorMessage: string): string {
    return `
        <div style="border: 1px solid #e74c3c; padding: 16px; max-width: 600px; margin: 0 auto; font-family: Arial, sans-serif; background-color: #f9ecec;">
            <h1 style="color: #e74c3c; font-size: 24px; border-bottom: 1px solid #e74c3c; padding-bottom: 8px;">Server Database Alert</h1>
            <p style="font-size: 16px; color: #333;">
                ${errorMessage}
            </p>
        </div>
    `;
  }
}

export default new EmailService();
