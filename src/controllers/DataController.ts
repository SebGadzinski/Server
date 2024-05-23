/**
 * @file Controller for Application Data needs
 * @author Sebastian Gadzinski
 */
import _ from 'lodash';
import { DateTime } from 'luxon';
import Result from '../classes/Result';
import config, { c } from '../config';
import {
  Category, Classes, Config, Meetings, Stats,
  User, VMStatusReport, Work, Worker, WorkTemplate
} from '../models';
import {
  ClassService,
  EmailService,
  FileService,
  SecurityService
} from '../services';

class DataController {

  constructor() {
    this.getHomePageData = this.getHomePageData.bind(this);
    this.getUserPageData = this.getUserPageData.bind(this);
    this.getProfile = this.getProfile.bind(this);
    this.saveProfile = this.saveProfile.bind(this);
  }

  public async getHomePageData(req: any, res: any) {
    try {
      const data = await Category.find().select(
        'name slug services.name services.slug services.thumbnailImg'
      );

      const workCards = [];
      const classCards = [];

      for (const category of data) {
        for (const service of category.services) {
          if (category.slug === 'classes') {
            classCards.push({
              category: category.name,
              categorySlug: category.slug,
              service: service.name,
              serviceSlug: service.slug,
              thumbnailImg: service.thumbnailImg
            });
          } else {
            workCards.push({
              category: category.name,
              categorySlug: category.slug,
              service: service.name,
              serviceSlug: service.slug,
              thumbnailImg: service.thumbnailImg
            });
          }
        }
      }

      res.send(new Result({ data: { workCards, classCards }, success: true }));
    } catch (err) {
      res.send(new Result({ message: err.message, success: false }));
    }
  }

  public async getAcceptingWorkState(req: any, res: any) {
    try {
      const acceptingWorkConfig = await Config.findOne({ name: 'acceptingWork' });
      const acceptingWorkState = acceptingWorkConfig?.value ?? {
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

      // Gather category service options
      const servicesOptions = await Category.getCategoryServiceOptions();

      res.send(new Result({
        data: { acceptingWorkState, servicesOptions },
        success: true
      }));
    } catch (err) {
      res.send(new Result({ message: err.message, success: false }));
    }
  }

  public async saveAcceptingWorkState(req: any, res: any) {
    try {
      if (!req?.body?.state) {
        throw new Error('No State Provided');
      }

      await Config.updateOne({ name: 'acceptingWork' }, {
        $set: {
          value: req.body.state
        }
      });

      res.send(new Result({ success: true }));
    } catch (err) {
      res.send(new Result({ message: err.message, success: false }));
    }
  }

  public async resetStats(req: any, res: any) {
    try {
      await Stats.deleteMany({});
      res.send(new Result({ success: true }));
    } catch (err) {
      res.send(new Result({ message: err.message, success: false }));
    }
  }

  public async getUserPageData(req: any, res: any) {
    try {
      const users = await User.aggregate([
        {
          $lookup: {
            from: 'works', // Replace with your 'Work' collection name
            localField: '_id',
            foreignField: 'userId',
            as: 'works'
          }
        },
        {
          $project: {
            userId: '$_id',
            fullName: 1,
            email: 1,
            emailConfirmed: 1,
            phoneNumber: 1,
            mfa: 1,
            works: 1 // Include the array of work items
          }
        },
        {
          $addFields: {
            works: {
              $map: {
                input: '$works',
                as: 'work',
                in: {
                  workId: '$$work._id',
                  userId: '$$work.userId',
                  meetingId: '$$work.meetingId',
                  categorySlug: '$$work.categorySlug',
                  serviceSlug: '$$work.serviceSlug',
                  workItems: '$$work.workItems',
                  status: '$$work.status',
                  paymentItems: '$$work.paymentItems',
                  initialPayment: '$$work.initialPayment',
                  subscription: '$$work.subscription',
                  initialPaymentStatus: '$$work.initialPaymentStatus',
                  cancellationPaymentStatus: '$$work.cancellationPaymentStatus'
                }
              }
            }
          }
        }
      ]);

      // Get Users and data
      for (let i = 0; i < users.length; i++) {
        let monthlyCost = 0;
        let totalPaymentsMadeCost = 0;
        users[i].activeWorkItems = 0;
        users[i].completeWorkItems = 0;
        const notActiveWorkStatus = [
          c.WORK_STATUS_OPTIONS.CANCELLATION_SET_UP,
          c.WORK_STATUS_OPTIONS.MEETING,
          c.WORK_STATUS_OPTIONS.CANCELLED,
          c.WORK_STATUS_OPTIONS.COMPLETED];

        // Calculate monthly subscription costs
        for (let y = 0; y < users[i].works.length; y++) {
          // Valid Active/Completed Work Item
          if (!notActiveWorkStatus.some((x) => x === users[i].works[y].status)) {
            users[i].activeWorkItems++;
          } else if (users[i].works[y].status === c.WORK_STATUS_OPTIONS.COMPLETED) {
            users[i].completeWorkItems++;
          }
          // initial payment
          if (users[i].works[y].initialPaymentStatus === c.PAYMENT_STATUS_OPTIONS.COMPLETED) {
            totalPaymentsMadeCost += users[i].works[y].initialPayment;
          }

          // subscription
          if (users[i].works[y].subscription.length > 0) {
            for (let t = 0; t < users[i].works[y].subscription.length; t++) {
              const sub = users[i].works[y].subscription[t];
              const paymentsMade = sub.paymentHistory.filter((x) => x.status === 'Completed').length;
              totalPaymentsMadeCost +=
                paymentsMade *
                sub.payment;
            }

            const currentSub =
              users[i].works[y].subscription[
              users[i].works[y].subscription.length - 1
              ];
            if (currentSub.interval === c.SUBSCRIPTION_INTERVAL_OPTIONS.SEVEN_DAYS) {
              monthlyCost += currentSub.payment * 4;
            } else if (currentSub.interval === c.SUBSCRIPTION_INTERVAL_OPTIONS.ONE_MONTH) {
              monthlyCost += currentSub.payment;
            } else if (currentSub.interval === c.SUBSCRIPTION_INTERVAL_OPTIONS.ONE_YEAR) {
              monthlyCost += currentSub.payment / 12;
            }
          }

          // each payment item
          for (let z = 0; z < users[i].works[y].paymentItems.length; z++) {
            if (users[i].works[y].paymentItems[z].status === c.PAYMENT_STATUS_OPTIONS.COMPLETED) {
              totalPaymentsMadeCost +=
                users[i].works[y].paymentItems[z].payment;
            }
          }
        }

        users[i].monthlyCost = monthlyCost;
        users[i].totalCost = totalPaymentsMadeCost;
        delete users[i].works;
      }

      res.send(new Result({ data: users, success: true }));
    } catch (err) {
      res.send(new Result({ message: err.message, success: false }));
    }
  }

  public async getVMStatusReports(req: any, res: any) {
    try {
      let reports: any = await VMStatusReport.find({}).lean();

      reports = reports.map((r) => {
        // Array of properties to check
        const propertiesToCheck = ['database', 'pm2', 'system'];
        let severity = 'ok'; // Default severity

        // Loop through each property
        for (const prop of propertiesToCheck) {
          if (r[prop].status.some((x) => x.severity === 'critical')) {
            severity = 'critical';
            break; // Stop checking further if any critical severity is found
          } else if (r[prop].status.some((x) => x.severity === 'warning') && severity !== 'critical') {
            severity = 'warning';
          }
        }
        const info = severity === 'critical' ? 'look at this' : '';
        return {
          id: r._id,
          section: 'main',
          name: 'getVMStatusReports',
          severity,
          info,
          date: r.createdAt
        };
      });
      reports.reverse();

      res.send(new Result({ success: true, data: reports }));
    } catch (err) {
      res.send(new Result({ message: err.message, success: false }));
    }
  }

  public async downloadVMStatusReport(req: any, res: any) {
    try {
      const report = await VMStatusReport.findById(req.body.id).lean();
      if (!report) {
        throw new Error('No report found');
      }

      const jsonFile = await FileService.toJsonFile(report, req.user.data.id);
      res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition, X-Errors');
      // Set the response headers to indicate the file type and name.
      res.setHeader(
        'Content-Disposition',
        `attachment; ${jsonFile.file.originalname}`
      );
      res.setHeader('Content-Type', jsonFile.file.mimetype);

      // If you'd like to send the errors as part of headers (not a common approach, but it's doable)
      res.setHeader('X-Errors', JSON.stringify(jsonFile.errors));

      // Send the updated Excel file as the response body.
      res.end(jsonFile.file.buffer);
    } catch (err) {
      res.send(new Result({ message: err.message, success: false }));
    }
  }

  public async getProfile(req: any, res: any) {
    try {
      // if not admin
      const userId = req?.body?.userId;

      // If userId is a thing and its not the user who is on check for admin
      if (userId && !req?.user?.data.roles.includes('admin')) {
        await SecurityService.accessDenied(req.ip);
      }

      // If no userId then retrun the users own
      let user: any = {};
      const queryUserId = userId ?? req.user.data.id;
      const selectionQuery: any = {
        _id: 0,
        name: '$fullName',
        email: 1,
        phoneNumber: 1
      };
      if (req?.user?.data.roles.includes('admin')) {
        selectionQuery.emailConfirmed = 1;
      }

      user = await User.findOne({ _id: queryUserId }, selectionQuery);

      if (!user?.phoneNumber) {
        user.phoneNumber = '';
      }

      res.send(new Result({ data: user, success: true }));
    } catch (err) {
      res.send(new Result({ message: err.message, success: false }));
    }
  }

  public async saveProfile(req: any, res: any) {
    try {
      // if not admin
      const userId = req?.body?.userId;

      // If userId is a thing and its not the user who is on check for admin
      if (userId && !req?.user?.data.roles.includes('admin')) {
        await SecurityService.accessDenied(req.ip);
      }

      const setQuery: any = {
        fullName: req.body.user.name, // New name value
        phoneNumber: req.body.user.phoneNumber
      };

      if (req?.user?.data.roles.includes('admin')) {
        setQuery.email = req.body.user.email;
        setQuery.emailConfirmed = req.body.user.emailConfirmed;
      }

      const queryUserId = userId ?? req.user.data.id;

      await User.updateOne(
        { _id: queryUserId }, // Filter to match the user to update
        {
          $set: setQuery
        }
      );

      res.send(new Result({ success: true }));
    } catch (err) {
      res.send(new Result({ message: err.message, success: false }));
    }
  }

}

export default new DataController();
