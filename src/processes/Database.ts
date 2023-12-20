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
          slug: 'software',
          services: [
            {
              name: 'Web Development',
              slug: 'web-development',
              description:
                'Design and development of websites and web applications.',
              thumbnailImg:
                'https://www.onlinecoursereport.com/wp-content/uploads/2020/07/shutterstock_394793860-1536x1177.jpg'
            },
            {
              name: 'Mobile App Development',
              slug: 'mobile-app-development',
              description:
                'Creation of applications for mobile devices across various platforms.',
              thumbnailImg:
                'https://techiflyer.com/wp-content/uploads/2019/05/mobile-app-development-service-in-surat-techiflyer.png'
            },
            // Add the slug attribute for the remaining services
            {
              name: 'Custom Software Development',
              slug: 'custom-software-development',
              description:
                'Tailor-made software solutions to meet specific business needs.',
              thumbnailImg:
                'https://www.exeideas.com/wp-content/uploads/2018/08/Custom-Software.jpg'
            },
            {
              name: 'Software Consulting',
              slug: 'software-consulting',
              description:
                'Expert advice on software strategies, optimization, and implementation.',
              thumbnailImg:
                'https://www.hvsscorp.com/wp-content/uploads/2020/12/931-consulting_service.jpg'
            },
            {
              name: 'Cloud Services',
              slug: 'cloud-services',
              description:
                'Services related to cloud computing, including storage and cloud-based application development.',
              thumbnailImg:
                'https://netdepot.com/wp-content/uploads/2020/09/best-cloud-servers.jpeg'
            },
            {
              name: 'UI/UX Design',
              slug: 'ui-ux-design',
              description:
                'Designing user interfaces and experiences for software and digital products.',
              thumbnailImg:
                'https://cdn.educba.com/academy/wp-content/uploads/2020/03/Software-Design.jpg'
            },
            {
              name: 'Software Testing',
              slug: 'software-testing',
              description:
                'Expert testing using the latest and best tools and software.',
              thumbnailImg:
                'https://fixingblog.com/wp-content/uploads/2021/06/AdobeStock_257701717-scaled.jpeg'
            }
          ],
          thumbnailImg:
            'https://www.flexsin.com/blog/wp-content/uploads/2019/12/Custom-Software-Development.jpg'
        },
        {
          name: 'Photography',
          slug: 'photography',
          services: [
            {
              name: 'Wedding Photography',
              slug: 'wedding-photography',
              description:
                'Capturing memorable moments and ceremonies of weddings.',
              thumbnailImg:
                'https://www.seanleblancphotography.com/wp-content/uploads/2019/01/Sean-LeBlanc-Photography-Best-Wedding-Photographs-of-2018-19.jpg'
            },
            {
              name: 'Portrait Photography',
              slug: 'portrait-photography',
              description: 'Photographic portraits of individuals or groups.',
              thumbnailImg:
                'https://blog.hahnemuehle.com/en/wp-content/uploads/sites/12/2015/07/Benedict-Cumberbatch-C-Mark-Mann.jpg'
            },
            // Add the slug attribute for the remaining services
            {
              name: 'Event Photography',
              slug: 'event-photography',
              description:
                'Photography services for various events and functions.',
              thumbnailImg:
                'https://i.pinimg.com/originals/09/bb/98/09bb9824e838dc7e8c8a1e9e90c15eba.jpg'
            },
            {
              name: 'Commercial Photography',
              slug: 'commercial-photography',
              description:
                'Professional photography for commercial purposes, including advertising and product placements.',
              thumbnailImg:
                'https://1.bp.blogspot.com/-2Vps8d4K_Yg/XvH3romk9lI/AAAAAAAAAE8/pM8U8htSY9U9L-boqBRtuUZ8dISnGMZ6wCK4BGAsYHg/s1765/Commercial%2BPhotography%2B4.jpg'
            },
            {
              name: 'Landscape Photography',
              slug: 'landscape-photography',
              description:
                'Capturing natural and urban landscapes in photographic art.',
              thumbnailImg:
                'https://tse1.mm.bing.net/th?id=OIP.L4nUSvQ7ZaefejVVEkLG5QHaEp&pid=Api&P=0&h=180'
            },
            {
              name: 'Travel Photography',
              slug: 'travel-photography',
              description:
                'Photography that captures the essence of a place and its culture during travels.',
              thumbnailImg:
                'http://travelingcanucks.com/wp-content/uploads/2017/05/Traveling_Canucks_Travel_Photography_005.jpg'
            }
          ],
          thumbnailImg:
            'http://foreverphotographychicago.com/wp-content/uploads/2014/11/studio-shoot.jpg'
        },
        {
          name: 'Videography',
          slug: 'videography',
          services: [
            {
              name: 'Wedding Videography',
              slug: 'wedding-videography',
              description: 'Recording and producing videos of wedding events.',
              thumbnailImg:
                'https://www.seanleblancphotography.com/wp-content/uploads/2019/01/Sean-LeBlanc-Photography-Best-Wedding-Photographs-of-2018-19.jpg'
            },
            {
              name: 'Commercial Videography',
              slug: 'commercial-videography',
              description:
                'Creating videos for commercial and advertising purposes.',
              thumbnailImg:
                'https://1.bp.blogspot.com/-2Vps8d4K_Yg/XvH3romk9lI/AAAAAAAAAE8/pM8U8htSY9U9L-boqBRtuUZ8dISnGMZ6wCK4BGAsYHg/s1765/Commercial%2BPhotography%2B4.jpg'
            },
            // Add the slug attribute for the remaining services
            {
              name: 'Documentary Production',
              slug: 'documentary-production',
              description:
                'Producing documentary films to explore real-life stories or issues.',
              thumbnailImg:
                'https://www.filmindependent.org/wp-content/uploads/2017/09/unnamed-9.jpg'
            },
            {
              name: 'Event Videography',
              slug: 'event-videography',
              description:
                'Video coverage of various events, including corporate and social events.',
              thumbnailImg:
                'https://i.pinimg.com/originals/09/bb/98/09bb9824e838dc7e8c8a1e9e90c15eba.jpg'
            },
            {
              name: 'Corporate Videography',
              slug: 'corporate-videography',
              description:
                'Producing videos for corporate communication, training, and marketing.',
              thumbnailImg:
                'https://fewstones.com/wp-content/uploads/2019/12/cameraman-and-middle-aged-businessman-making-PQLKDFT.jpg'
            },
            {
              name: 'Music Video Production',
              slug: 'music-video-production',
              description:
                'Creating music videos for artists, bands, and record labels.',
              thumbnailImg:
                'https://s3.amazonaws.com/pbblogassets/uploads/2019/08/01101726/videography-cover.jpg'
            }
          ],
          thumbnailImg:
            'https://cs3design.com/wp-content/uploads/2020/06/videographer-footer-background.jpg'
        }
      ];

      // Insert categories into the database
      for (const category of sampleCategories) {
        const newCategory = new Category({
          name: category.name,
          slug: category.slug,
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
