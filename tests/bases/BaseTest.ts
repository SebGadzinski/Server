/**
 * @file Base Test Class.
 * @author Sebastian Gadzinski
 */

import mongoose from 'mongoose';
import config from '../../src/config';
import bluebird from 'bluebird';
import { IUser } from '../../src/models/User';
import UserService from '../../src/services/UserService';
import userData from '../data/users';

/**
 * Base testting class
 */
export default abstract class BaseTest {
  constructor() {
    mongoose.Promise = bluebird;
  }

  /**
   * Sets up mongo db connection
   * @param wipeDatabase If set true wipes database
   */
  async startMongo(wipeDatabase: boolean = true) {
    try {
      //TODO: its not good practice verify connection is not live here
      console.log('Connecting to mongo db...');
      await mongoose.connect(config.databaseUrl);

      if (wipeDatabase) {
        //Delete all data from database
        console.log('Wiping database...');

        const collections = await mongoose.connection.db
          .listCollections()
          .toArray();

        for (const collection of collections) {
          try {
            await mongoose.connection.db.dropCollection(collection.name);
          } catch (error) {
            console.log(`Cannot drop collection ${collection}: ${error}`);
          }
        }
        console.log('Wipe completed...');
      }
    } catch (err) {
      console.error(err);
    }
  }

  /**
   * Creates x amount of simple users with emails userx@gmail.com and password Userpassword2!
   * @param amount
   * @param properties
   * @returns
   */
  async createSimpleUsers(amount: number, properties?: any): Promise<IUser[]> {
    try {
      const users: IUser[] = [];
      for (let i = 1; i < amount + 1; i++) {
        let simpleUser = userData.simpleSignIn;
        simpleUser.email = `user${i}@gmail.com`;
        if (properties) {
          Object.keys(properties).forEach((key) => {
            if (simpleUser.hasOwnProperty(key)) {
              simpleUser[key] = properties[key];
            }
          });
        }
        let test = await UserService.create(simpleUser);
        users.push(test);
      }
      return users;
    } catch (err) {
      console.error(err);
      throw err;
    }
  }

  /**
   * Kills mongo db connection
   */
  async killMongo() {
    await mongoose.connection.close();
  }
}
