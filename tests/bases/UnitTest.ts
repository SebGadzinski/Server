/**
 * @file Unit Test Class.
 * @author Sebastian Gadzinski
 */

import mongoose from 'mongoose';
import config from '../../src/config';
import bluebird from 'bluebird';
import { IUser } from '../../src/models/User';
import UserService from '../../src/services/UserService';
import userData from '../data/users';
import BaseTest from './BaseTest';

/**
 * Base class which wipes out database before starting test
 */
export default abstract class UnitTest extends BaseTest {
  public testName: string;

  constructor(testName: string) {
    super();
    this.testName = testName;
  }
}
