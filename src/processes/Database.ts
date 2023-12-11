import { LocalDateTime } from '@js-joda/core';
import { Mail } from '@sendgrid/helpers/classes';
import bluebird from 'bluebird';
import { CronJob } from 'cron';
import mongoose from 'mongoose';
import config from '../config';
import { Token } from '../models';
import EmailService from '../services/EmailService';

const originalLog = console.log;

// Overwrite the console.log function using an arrow function
console.log = (...args: any[]) => {
  const currentDate = new Date().toISOString() + ' ||';
  originalLog(currentDate, ...args);
};

class Database {
  private readonly DELETE_TOKENS_DAYS = 1;
  private readonly SUBJECT = 'ALERT - Server - Database';

  public async run() {
    await this.connectToMongo();
    this.cleanTokens();
  }

  private async connectToMongo() {
    console.log('Connecting to Mongo');
    // Configure promise with Bluebird and connect to MongoDB.
    mongoose.Promise = bluebird;
    await mongoose.connect(config.databaseUrl);
  }

  private cleanTokens() {
    const job = new CronJob(
      '0 */1 * * * *',
      async () => {
        try {
          await Token.deleteMany({
            expiration: {
              $lt: LocalDateTime.now().minusDays(this.DELETE_TOKENS_DAYS)
            }
          });
          console.log(
            `${new Date()} || Cleared tokens older than ${
              this.DELETE_TOKENS_DAYS
            } days old...`
          );
        } catch (err) {
          // Email me if this occurs
          await EmailService.sendEmail(
            new Mail({
              from: config.sendGrid.emailNoResponse,
              to: config.alertEmail,
              subject: this.SUBJECT,
              html: EmailService.errorHtml(err)
            })
          );
        }
      },
      null,
      true,
      'America/Toronto'
    );

    console.log('Cleaning tokens running...');
    job.start();
  }
}

const db = new Database();
db.run();
