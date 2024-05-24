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
