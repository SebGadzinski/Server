import { LocalDateTime } from '@js-joda/core';
import { Mail } from '@sendgrid/helpers/classes';
import bluebird from 'bluebird';
import { CronJob } from 'cron';
import mongoose from 'mongoose';
import config from '../config';
import { Category, Token } from '../models';
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
    await this.createAndInsertSampleCategories();
    // this.cleanTokens();
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
              from: config.sendGrid.email.noReply,
              to: config.sendGrid.email.alert,
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

  private async createAndInsertSampleCategories() {
    try {
      // Connect to MongoDB if not already connected
      if (mongoose.connection.readyState !== 1) {
        await mongoose.connect('your-mongodb-connection-string'); // Replace with your MongoDB connection string
      }

      // Define sample categories and their services
      const sampleCategories = [
        {
          name: 'Software',
          services: [
            'Web Development',
            'Mobile App Development',
            'Custom Software Development',
            'Software Consulting',
            'Cloud Services',
            'UI/UX Design'
          ],
          thumbnailImg:
            'https://files.oaiusercontent.com/file-VaNRbaew6b63qLWP9BAjpzZi?se=2023-12-19T21%3A18%3A07Z&sp=r&sv=2021-08-06&sr=b&rscc=max-age%3D31536000%2C%20immutable&rscd=attachment%3B%20filename%3D360da6eb-aa6b-4b40-969c-0047a42cff30.webp&sig=kOuuSO1W8Zp56yl3%2BM/yZBYlX9uD5tyoZTK335qnP70%3D'
        },
        {
          name: 'Photography',
          services: [
            'Wedding Photography',
            'Portrait Photography',
            'Event Photography',
            'Commercial Photography',
            'Landscape Photography',
            'Travel Photography'
          ],
          thumbnailImg:
            'https://files.oaiusercontent.com/file-gc3bVVg7GQtZZCXoCT7qxK4x?se=2023-12-19T21%3A18%3A30Z&sp=r&sv=2021-08-06&sr=b&rscc=max-age%3D31536000%2C%20immutable&rscd=attachment%3B%20filename%3D7aa09acc-5988-4f24-95f1-be68c4cfa31c.webp&sig=jJjljAaF1ilqPbXk%2BhE34t5NnPEVlSbLt/AhmS8scbE%3D'
        },
        {
          name: 'Videography',
          services: [
            'Wedding Videography',
            'Commercial Videography',
            'Documentary Production',
            'Event Videography',
            'Corporate Videography',
            'Music Video Production'
          ],
          thumbnailImg:
            'https://files.oaiusercontent.com/file-vZMLlezEZ4GQhh3pRbv1YuYy?se=2023-12-19T21%3A18%3A46Z&sp=r&sv=2021-08-06&sr=b&rscc=max-age%3D31536000%2C%20immutable&rscd=attachment%3B%20filename%3D39df4e37-30a6-4b1e-bd2d-c256229fa092.webp&sig=2NIW0yLi4P/dk8y6xp4qqjTLtWrItMZ2QLYQAODEMVg%3D'
        }
      ];

      // Insert categories into the database
      for (const category of sampleCategories) {
        const newCategory = new Category({
          name: category.name,
          services: category.services,
          thumbnailImg: category.thumbnailImg
        });

        await newCategory.save();
      }

      console.log('Sample categories have been created and inserted.');
    } catch (error) {
      console.error('Error creating and inserting sample categories:', error);
    }
  }
}

const db = new Database();
db.run();
