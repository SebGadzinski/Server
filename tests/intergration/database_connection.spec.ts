/**
 * @file Tests database connection
 * @author Sebastian Gadzinski
 */

import mongoose from 'mongoose';
import bluebird from 'bluebird';
import config from '../../src/config';

describe('Database Connection', () => {
  before(() => {
    mongoose.Promise = bluebird;
  });

  it('should connect to MongoDB successfully', async () => {
    console.log('Connecting...');
    await mongoose.connect(config.databaseUrl);
  });

  after(() => {
    mongoose.disconnect();
  });
});
