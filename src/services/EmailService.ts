/**
 * @file Email related functionality.
 * @author Sebastian Gadzinski
 */

import { Mail, Response } from '@sendgrid/helpers/classes';
import { EmailData } from '@sendgrid/helpers/classes/email-address';
import sendgrid from '@sendgrid/mail';
// import axios from 'axios';
import { Schema } from 'mongoose';
import validator from 'validator';
import Notification from '../classes/Notification';
import config from '../config';
import { Category } from '../models';
import { IWork } from '../models/Work';
import NotificationService from './NotificationService';

const sendGridJson = config.sendGrid;

export interface IEmailService {
  sendResetPasswordEmail(to: EmailData, token: string): Promise<void>;
  sendConfirmationEmail(to: EmailData, token: string): Promise<void>;
  sendEmail(mail: Mail): Promise<void>;
  errorHtml(errorMessage: string): string;
}

type ObjectId = Schema.Types.ObjectId;

class EmailService implements IEmailService {
  private readonly CANNOT_SEND_MAIL = 'Could not send mail';
  private readonly EMAIL_SENT_CODE = 202;
  private verifaliaToken: string;

  constructor() {
    sendgrid.setApiKey(sendGridJson.apiKey);
  }

  /**
   * Validates an email address using SendGrid's Email Validation API.
   * @param {string} email The email address to validate.
   * @returns {Promise<boolean>} A promise that resolves to true if the email is valid, false otherwise.
   */
  public async validateEmail(email: string): Promise<boolean> {
    try {
      // TODO replace with verifailia validator
      return await validator.isEmail(email);
    } catch (error) {
      console.error('Error validating email:', error);
      return false;
    }
  }

  /**
   *
   * @param {Mail} mail Sendgrid mail object
   * @returns {Result} Result.error if there is something wrong
   */
  public async sendEmail(mail: any | Mail, force?: boolean): Promise<void> {
    try {
      if (config.sendEmailStatus === 'sending' || force) {
        const sgResult = await sendgrid.send(mail);
        if (sgResult) {
          const error = sgResult.find(
            (x) =>
              x instanceof Response && x.statusCode !== this.EMAIL_SENT_CODE
          );
          if (error) {
            console.error(JSON.stringify(error));
            throw new Error(this.CANNOT_SEND_MAIL);
          }
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

  public async sendNotificationEmail({
    to,
    title,
    header,
    body,
    link,
    btnMessage,
    appNotification,
    work,
  }: {
    to: EmailData,
    title: string,
    header: string,
    body: string,
    link: string,
    btnMessage: string,
    appNotification?: {
      id: string | ObjectId,
      notification: Notification,
    },
    work?: IWork,
  }): Promise<void> {
    if (typeof to === 'string') {
      to = { email: to };
    }

    if (appNotification) {
      try {
        await NotificationService.sendNotification(
          appNotification.id,
          appNotification.notification
        );
      } catch (err) {
        console.error(err);
      }
    }

    const email: any = {
      to,
      from: sendGridJson.email.noReply,
      subject: sendGridJson.notification.subject,
      templateId: sendGridJson.notification.template,
      dynamicTemplateData: {
        title,
        header,
        body,
        company_name: config.company,
        btn_link: link,
        btn_message: btnMessage
      }
    };

    // Create work meta data
    if (work) {
      const names = await Category.getNames(work.categorySlug, work.serviceSlug);
      email.dynamicTemplateData.meta_data = {
        work_id: work._id,
        category: names.category,
        service: names.service
      };
    }

    const mail = new Mail(email);

    await this.sendEmail(mail);
  }

  /**
   * Sends a receipt email to a user
   * @param to - Recipient's email address
   * @param transactionDetails - Details of the transaction
   */
  public async sendReceiptEmail(
    { to, metaData, transactionDetails, paymentMethod, transactionId }
      : {
        to: EmailData,
        metaData: { workId: string | Schema.Types.ObjectId, category: string, service: string },
        transactionDetails: {
          date: string;
          amount: number;
          items: Array<{ name: string; quantity: number; price: string }>;
        },
        paymentMethod: string,
        transactionId: string
      }): Promise<void> {
    if (typeof to === 'string') {
      to = { email: to };
    }

    const mail = new Mail({
      to,
      from: sendGridJson.email.noReply,
      subject: 'Your Receipt from ' + config.company,
      templateId: sendGridJson.receipt.template,
      dynamicTemplateData: {
        header_message: 'Thank you for your purchase!',
        company_name: config.company,
        transaction_date: transactionDetails.date,
        transaction_amount: `${transactionDetails.amount.toFixed(2)} CAD`,
        transaction_items: transactionDetails.items,
        work_id: metaData.workId,
        category: metaData.category,
        service: metaData.service,
        payment_method: paymentMethod,
        transaction_id: transactionId,
        footer_message:
          'If you have any questions, contact us at ' +
          sendGridJson.email.support
      }
    });

    await this.sendEmail(mail, true);
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

  // TODO: Mabye if I get money i can enable email validation through Good API

  // private async authenticateVerifalia(): Promise<void> {
  //   try {
  //     // Define the token request parameters
  //     const tokenRequestData = {
  //       method: 'POST',
  //       data: config.verifalia,
  //       url: `https://api.verifalia.com/v2.4/auth/tokens`,
  //       headers: {
  //         'Content-Type': 'application/json'
  //       }
  //     };

  //     // Send the token request
  //     const response = await axios(tokenRequestData);
  //     this.verifaliaToken = response.data.accessToken;
  //   } catch (error) {
  //     console.error('Error obtaining Zoom access token:', error);
  //   }
  // }

  // /**
  //  * Validates an email address using SendGrid's Email Validation API.
  //  * @param {string} email The email address to validate.
  //  * @returns {Promise<boolean>} A promise that resolves to true if the email is valid, false otherwise.
  //  */
  // public async validateEmail(email: string): Promise<boolean> {
  //   try {

  //     // Verify email address string is at least believable before
  //     // Using the verifilia

  //     if (!this.verifaliaToken) {
  //       await this.authenticateVerifalia();
  //     }

  //     const response = await axios({
  //       method: 'post',
  //       url: 'https://api.verifalia.com/v2.4/email-validations',
  //       headers: {
  //         'Authorization': `Bearer ${this.verifaliaToken}`,
  //       },
  //       data: {
  //         entries: [
  //           { inputData: email }
  //         ]
  //       }
  //     });

  //     const id = response?.data?.id

  //     if (!id) throw new Error("Email Not Valid");

  //     const idResponse = await axios({
  //       method: 'get',
  //       url: `https://api.verifalia.com/v2.4/email-validations/${id}`,
  //       headers: {
  //         'Authorization': `Bearer ${this.verifaliaToken}`,
  //       }
  //     });

  //     return idResponse?.data?.entries?.some(x => x.status === "Success");
  //   } catch (error) {
  //     console.error('Error validating email:', error);
  //     return false;
  //   }
  // }
}

export default new EmailService();
