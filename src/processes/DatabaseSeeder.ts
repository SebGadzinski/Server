/**
 * @author Sebastian Gadzinski
 */

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { DateTime } from 'luxon';
import config from '../config';
import CATEGORY_JSON from '../configs/db/categories.json';
import TEMPLATES_JSON from '../configs/db/templates.json';
import USERS_JSON from '../configs/db/users.json';
import WORKERS_JSON from '../configs/db/workers.json';
import { Category, Classes, Config, Meetings, UnivailableDates, User, Worker, WorkTemplate } from '../models';
import { IUser } from '../models/User';
import Process from './_Process';
// TODO: get file from logging or something vars
// import CLASSES_JSON from '../configs/db/classes.json';
// import BOOK_MEETING_INTERVALS_JSON from '../configs/db/classes.json';

const originalLog = console.log;

// Overwrite the console.log function using an arrow function
console.log = (...args: any[]) => {
  const currentDate = new Date().toISOString() + ' ||';
  originalLog(currentDate, ...args);
};

class DatabaseSeeder extends Process {

  // Used in multiple functions
  private readonly classInfo = {
    'figma': {
      instructorIds: [],
      occupancyCap: 50,
      duration: 60,
      comeIn: false,
      meetingTimes: [
        // Tuesday 6
        DateTime.utc().set({
          year: 2023, month: 2, day: 28,
          hour: 23, minute: 0, second: 0, millisecond: 0
        }).toJSDate(),
      ]
    },
    'pec-dancing': {
      instructorIds: [],
      occupancyCap: 50,
      duration: 30,
      comeIn: false,
      meetingTimes: [
        // Tuesday 7pm
        DateTime.utc().set({
          year: 2023, month: 3, day: 1,
          hour: 0, minute: 0, second: 0, millisecond: 0
        }).toJSDate(),
      ]
    },
    'make-web-app': {
      instructorIds: [],
      occupancyCap: 50,
      duration: 60,
      comeIn: false,
      meetingTimes: [
        // Tuesday 8pm
        DateTime.utc().set({
          year: 2023, month: 3, day: 1,
          hour: 1, minute: 0, second: 0, millisecond: 0
        }).toJSDate(),
      ]
    },
    'chair-yoga': {
      instructorIds: [],
      occupancyCap: 50,
      duration: 30,
      comeIn: false,
      meetingTimes: [
        // Saturdays 1pm
        DateTime.utc().set({
          year: 2023, month: 3, day: 4,
          hour: 18, minute: 0, second: 0, millisecond: 0
        }).toJSDate(),
      ],
    },
    'remote-coach-health-fitness': {
      instructorIds: [],
      occupancyCap: 50,
      duration: 30,
      comeIn: false,
      // Custom meeting times for each user
      meetingTimes: []
    },
    'davids-motivation-matrix': {
      instructorIds: [],
      occupancyCap: 50,
      duration: 30,
      comeIn: false,
      // Custom meeting times for each user
      meetingTimes: []
    },
    'krystyna-and-harrys-story-time': {
      instructorIds: [],
      occupancyCap: 50,
      duration: 30,
      comeIn: false,
      // Custom meeting times for each user
      meetingTimes: []
    },
    'get-schooled-son': {
      instructorIds: [],
      occupancyCap: 50,
      duration: 30,
      comeIn: false,
      meetingTimes: [
        // Tuesday 10pm
        DateTime.utc().set({
          year: 2023, month: 3, day: 1,
          hour: 3, minute: 0, second: 0, millisecond: 0
        }).toJSDate(),
      ]
    }
  };

  public async run() {
    await super.run();
    // await this.createAndInsertUNVDATESCategories();
    await this.createConfigs();
    await this.createAndInsertSampleCategories();
    await this.updateCategoryServicePictures();
    await this.createClasses();
    await this.createWorkTemplates();
    await this.createWorkers();
    process.exit(0);
  }

  private createAndInsertSampleUsers() {
    return new Promise<IUser[]>((resolve, reject) => {
      const sampleUsers: IUser[] = [];
      const users: any = USERS_JSON;

      let count = 0;
      for (const user of users) {
        // Attempt to keep passwords
        User.findOne({ email: user.email }).then((delUser) => {
          if (!delUser) {
            User.deleteOne({ email: user.email }).then(() => {
              bcrypt.genSalt(config.saltRounds, (saltError, salt) => {
                user.password = 'Password123!';

                if (saltError) return reject('Salt error.');

                bcrypt.hash(user.password, salt, (hashError, hash) => {
                  if (hashError) return reject('Hash error.');

                  const refreshToken = jwt.sign(
                    { data: { email: user.email, fullName: user.fullName } },
                    config.secret
                  );

                  user.refreshToken = refreshToken;
                  user.password = hash;
                  user.salt = salt;

                  // Neccessary Fields
                  user.createdBy = 'seeder';
                  user.updatedBy = 'seeder';
                  user.mfa = false;

                  User.create(user)
                    .then(async (userDoc: IUser) => {
                      userDoc.refreshToken = jwt.sign(
                        {
                          data: {
                            id: userDoc._id,
                            email: userDoc.email,
                            expiresAt:
                              new Date().getTime() + config.tokenExpirySeconds,
                            fullName: userDoc.fullName,
                            roles: userDoc.roles
                          }
                        },
                        config.secret,
                        { expiresIn: config.tokenExpirySeconds }
                      );
                      await userDoc.updateOne({ refreshToken: 1 });
                      sampleUsers.push(userDoc);
                      if (count + 1 === users.length) {
                        return resolve(sampleUsers);
                      }
                      count++;
                    })
                    .catch((error) => {
                      reject(`User creation failed. ${error}`);
                    });
                });
              });
            });
          } else {
            if (count + 1 === users.length) {
              return resolve(sampleUsers);
            }
            count++;
          }
        });
      }

      // const names = ['alex', 'jack', 'meghan', 'joanna', 'sebastian'];
      // for (let i = 1; i <= names.length; i++) {
      //   const user = {
      //     email: `${names[i]}@example.com`,
      //     emailConfirmed: false,
      //     fullName: `${names[i]} Magee`,
      //     password: ``,
      //     mfa: false,
      //     roles: ['user'],
      //     refreshToken: ``, // Replace 'your-secret-key' with your JWT secret
      //     salt: ``,
      //     createdBy: ``,
      //     updatedBy: ``
      //   };
      //   User.deleteOne({ email: user.email }).then(() => {
      //     bcrypt.genSalt(config.saltRounds, (saltError, salt) => {
      //       if (saltError) return reject('Salt error.');

      //       bcrypt.hash(user.password, salt, (hashError, hash) => {
      //         if (hashError) return reject('Hash error.');

      //         const refreshToken = jwt.sign(
      //           { data: { email: user.email, fullName: user.fullName } },
      //           config.secret
      //         );

      //         user.refreshToken = refreshToken;
      //         user.password = hash;
      //         user.salt = salt;

      //         // Neccessary Fields
      //         user.createdBy = 'server';
      //         user.updatedBy = 'server';
      //         user.mfa = false;

      //         User.create(user)
      //           .then(async (userDoc: IUser) => {
      //             userDoc.refreshToken = jwt.sign(
      //               {
      //                 data: {
      //                   id: userDoc._id,
      //                   email: userDoc.email,
      //                   expiresAt:
      //                     new Date().getTime() + config.tokenExpirySeconds,
      //                   fullName: userDoc.fullName,
      //                   roles: userDoc.roles
      //                 }
      //               },
      //               config.secret,
      //               { expiresIn: config.tokenExpirySeconds }
      //             );
      //             await userDoc.updateOne({ refreshToken: 1 });

      //             if (i + 1 === names.length) {
      //               return resolve(sampleUsers);
      //             }
      //             sampleUsers.push(userDoc);
      //           })
      //           .catch((error) => {
      //             reject(`User creation failed. ${error}`);
      //           });
      //       });
      //     });
      //   });
      // }
    });
  }

  private async createSampleMeetings(users: IUser[]): Promise<void> {
    await Meetings.deleteMany({});
    const startDate = new Date();
    const sebUser = await User.findOne({ email: 'seb.gadzy@gmail.com' }).lean();

    const getMeeting = (user: IUser): any => {
      const start = new Date(startDate);
      start.setMinutes(0);
      start.setSeconds(0);
      start.setMilliseconds(0);
      const end = new Date(start);
      end.setDate(end.getDate() + 1); // Set end date to one day after start
      end.setMinutes(0);
      end.setSeconds(0);
      end.setMilliseconds(0);

      return {
        // hostUserId: sebUser._id,
        categorySlug: 'software',
        serviceSlug: 'web-development', // Modify as needed
        users: [user._id],
        startDate: start,
        endDate: end
      };
    };

    let i = 0;
    for (const user of users) {
      if (i++ === 2) {
        continue;
      }
      const meeting = getMeeting(user);
      const newMeeting = new Meetings(meeting);
      await newMeeting.save();

      // Increment startDate for next iteration
      startDate.setDate(startDate.getDate() + 2); // Increment by 2 days for the next set of meetings
    }
  }

  private async createConfigs() {
    await Config.deleteMany({});

    const acceptingWork = {
      name: 'acceptingWork',
      value: {
        classes: {
          accepting: false,
          noService: []
        },
        software: {
          accepting: false,
          noService: []
        },
        photography: {
          accepting: false,
          noService: []
        },
        videography: {
          accepting: false,
          noService: []
        }
      }
    };

    if (config.acceptingWork !== 'no') {
      acceptingWork.value.classes.accepting = true;
      acceptingWork.value.software.accepting = true;
      acceptingWork.value.photography.accepting = true;
      acceptingWork.value.videography.accepting = true;
    }

    // TODO: Make custom for prod

    await Config.insertMany([acceptingWork]);
  }

  private async createClasses() {
    await Classes.deleteMany({});

    const classes = await Category.findOne({ slug: 'classes' }).select('services.slug').lean();

    await Classes.insertMany(classes.services.map((x) => {
      return { serviceSlug: x.slug, ...this.classInfo[x.slug] };
    }));
    console.log('Class info was complete.');
  }

  private async createAndInsertUNVDATESCategories() {
    await UnivailableDates.deleteMany({});
    // TODO: update this to add meeting dates?
    const user = await User.findOne({ email: 'seb.gadzy@gmail.com' }).lean();
    const start = new Date();
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    const univailableDates = new UnivailableDates({
      userId: user._id,
      startDate: start,
      endDate: end
    });
    await univailableDates.save();
  }

  private async createAndInsertSampleCategories() {
    try {
      await Category.deleteMany({});
      const users = await this.createAndInsertSampleUsers();

      // await this.createSampleMeetings(users);

      // Define sample categories and their services
      const oneDayInMillis = 24 * 60 * 60 * 1000; // Milliseconds in a day
      const oneAndHalfDayInMillis = oneDayInMillis + oneDayInMillis / 2;

      const currentDate = new Date();
      const startDateForUnavailable = new Date(
        currentDate.getTime() + oneDayInMillis
      );
      const endDateForUnavailable = new Date(
        currentDate.getTime() + oneAndHalfDayInMillis
      );

      const bookMeetingIntervals = [
        // Monday
        {
          start: DateTime.utc().set({
            year: 2023, month: 2, day: 27,
            hour: 18, minute: 0, second: 0, millisecond: 0
          }).toJSDate(),
          end: DateTime.utc().set({
            year: 2023, month: 2, day: 27,
            hour: 22, minute: 0, second: 0, millisecond: 0
          }).toJSDate(),
        },
        // Wed
        {
          start: DateTime.utc().set({
            year: 2023, month: 3, day: 1,
            hour: 18, minute: 0, second: 0, millisecond: 0
          }).toJSDate(),
          end: DateTime.utc().set({
            year: 2023, month: 3, day: 1,
            hour: 22, minute: 0, second: 0, millisecond: 0
          }).toJSDate(),
        },
        // Friday
        {
          start: DateTime.utc().set({
            year: 2023, month: 3, day: 3,
            hour: 18, minute: 0, second: 0, millisecond: 0
          }).toJSDate(),
          end: DateTime.utc().set({
            year: 2023, month: 3, day: 3,
            hour: 22, minute: 0, second: 0, millisecond: 0
          }).toJSDate(),
        },
      ];

      const sampleDatabase: any[] = CATEGORY_JSON;

      sampleDatabase.forEach((category) => {
        category.services.forEach((service) => {
          service.bookMeetingIntervals = bookMeetingIntervals;
          if (category.slug === 'classes') {
            service.meetingTimes = this.classInfo[service.slug].meetingTimes;
          }
          service.bookMeetingIntervals = bookMeetingIntervals;
        });
      });

      // Insert categories into the database
      for (const category of sampleDatabase) {
        const newCategory = new Category({
          name: category.name,
          slug: category.slug,
          services: category.services,
          thumbnailImg: category.thumbnailImg,
          watchMeImg: category.watchMeImg,
          watchMeLink: category.watchMeLink
        });

        await newCategory.save();
      }

      console.log('Sample categories have been created and inserted.');
    } catch (error) {
      console.error('Error creating and inserting sample categories:', error);
    }
  }

  private async createWorkTemplates() {
    await WorkTemplate.deleteMany({});
    const currentDate = new Date();
    const templates: any = TEMPLATES_JSON;
    const modifier: string = 'seeder';

    for (const template of templates) {
      template.updatedAt = currentDate;
      template.createdAt = currentDate;
      template.updatedBy = modifier;
      template.createdBy = modifier;
    }
    await WorkTemplate.insertMany(templates);
    console.log('Work Templates inserted.');
  }

  private async createWorkers() {
    await Worker.deleteMany({});
    function rW(str: string) {
      return str.replace(/\s+/g, '');
    }

    const workers: any = WORKERS_JSON;
    const currentDate = new Date();
    const modifier: string = 'seeder';
    const users = (await User.find({}).lean()).reduce((acc, user) => {
      acc[user.email] = user;
      return acc;
    }, {});
    const templates = (await WorkTemplate.find({}).lean()).reduce((acc, template) => {
      acc[`${rW(template.category)}-${rW(template.service)}-${rW(template.name)}`] = template;
      return acc;
    }, {});

    for (const worker of workers) {
      worker.updatedAt = currentDate;
      worker.createdAt = currentDate;
      worker.updatedBy = modifier;
      worker.createdBy = modifier;

      worker.thumbnailImg = `https://gadzy-work.com${worker.thumbnailImg}`;

      // Link User
      worker.userId = users[worker.d.email]._id;

      // Link Templates
      worker.templates = [];
      if (worker?.d?.templates) {
        for (const n of worker.d.templates) {
          worker.templates.push(
            templates[`${rW(worker.d.category)}-${rW(worker.d.service)}-${rW(n)}`]
              ._id);
        }
      }

      delete worker.d;
    }

    await Worker.insertMany(workers);
    const allWorkers = await Worker.find({});

    for (const worker of allWorkers) {
      // Link to classes
      if (worker.categorySlug === 'classes') {
        await Classes.updateOne(
          { serviceSlug: worker.serviceSlug },
          { $addToSet: { instructorIds: worker._id } }
        );
      }
    }

    console.log('Workers inserted.');
  }

  private async updateCategoryServicePictures() {
    try {
      const categories = await Category.find({});

      for (const category of categories) {
        const firstService = category.services[0].slides[0].text
          .toLowerCase()
          .replace(/\s+/g, '-');
        const cateogryThumbnail = `https://gadzy-work.com/images/${category.slug}/${category.services[0].slug}/desktop/${firstService}`;
        const fileType = ['software', 'classes'].some((x) => x === category.slug) ? 'png' : 'JPG';
        if (category.name === 'Videography') category.thumbnailImg = 'https://cs3design.com/wp-content/uploads/2020/06/videographer-footer-background.jpg';
        else if (category.name === 'Photography') category.thumbnailImg = 'https://gadzy-work.com/images/photography/card.png';
        else category.thumbnailImg = `${cateogryThumbnail}.${fileType}`;
        category.watchMeImg = `https://gadzy-work.com/images/${category.slug}/watch-me.png`;
        category.watchMeLink = `https://www.youtube.com/channel/UCxjCGF7u1wTXjjDsKHe7NgA`;

        for (const service of category.services) {
          const index = `https://gadzy-work.com/images/${category.slug}/${service.slug}/desktop`;
          const formattedThumbnail = service.slides[0].text
            .toLowerCase()
            .replace(/\s+/g, '-'); // Replaces one or more spaces with a single hyphen
          service.thumbnailImg = `${index}/${formattedThumbnail}.${fileType}`;

          for (const slide of service.slides) {
            const formattedText = slide.text
              .toLowerCase()
              .replace(/\s+/g, '-'); // Replaces one or more spaces with a single hyphen
            slide.image = `${index}/${formattedText}.${fileType}`;
          }
        }

        category.save();
      }
    } catch (err) {
      console.error('Error upserting category and service slides:', err);
    }
  }
}

const seedDB = new DatabaseSeeder('DatabaseSeeder', { connectToDb: true, startMessage: 'Time to make babies...' });
seedDB.run();
