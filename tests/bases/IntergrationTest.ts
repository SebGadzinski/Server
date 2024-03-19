/**
 * @file Intergration Test Class.
 * @author Sebastian Gadzinski
 */

import mongoose from 'mongoose';
import config from '../../src/config';
import bluebird from 'bluebird';
import axios, { AxiosInstance } from 'axios';
import BaseTest from './BaseTest';

/**
 * Base class which wipes out database before starting test
 */
export default abstract class IntergrationTest extends BaseTest {
  public ax: AxiosInstance;
  public testName: string;

  constructor(testName: string, routePath: string) {
    super();
    this.ax = axios.create({
      baseURL: `http://localhost:${config.port}${routePath}`
    });
    this.testName = testName;
  }

  // login : users: JSON

  // sign up


}
