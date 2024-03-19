/**
 * @file Email Unit Tests For Services
 * @author Sebastian Gadzinski
 */

import { expect } from 'chai';
import UnitTest from '../../bases/UnitTest';
import EmailService from '../../../src/services/EmailService';
import { Mail } from '@sendgrid/helpers/classes';

/**
 * Be prepared to receive some emails
 */
class EmailServiceTest extends UnitTest {
  private fromEmail = 'shorts.ai.do.not.reply@gmail.com';
  private toEmails = [
    'sebastiangadzinskiwork@gmail.com',
    'seb.gadzy@gmail.com'
  ];

  constructor() {
    super('Email Service Tests');
    this.run();
  }

  run() {
    describe(this.testName, () => {
      before(this.startMongo);

      it('Send Single Email', async () => {
        let testMail = new Mail({
          from: this.fromEmail,
          to: this.toEmails[0],
          subject: 'TESTING SINGLE',
          text: 'Testing Single',
          html: '<p>TESTING SINGLE</p>'
        });

        await EmailService.sendEmail(testMail);
      });

      it('Send Multiple Emails', async () => {
        let testMail = new Mail({
          from: this.fromEmail,
          to: this.toEmails,
          subject: 'TESTING MULTIPLE',
          text: 'Testing Multiple',
          html: '<p>TESTING MULTIPLE</p>'
        });

        await EmailService.sendEmail(testMail);
      });

      it('Send Confirmation Email', async () => {
        await EmailService.sendConfirmationEmail(
          { name: 'Sebastian', email: this.toEmails[0] },
          'token'
        );
      });

      it('Send Reset Password Email', async () => {
        await EmailService.sendResetPasswordEmail(
          { name: 'Sebastian', email: this.toEmails[0] },
          'token'
        );
      });
    });
  }
}

new EmailServiceTest();
