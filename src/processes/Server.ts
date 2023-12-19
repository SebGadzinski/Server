/**
 * @file Startup file.
 * @author Sebastian Gadzinski
 */

import bluebird from 'bluebird';
import cors from 'cors';
import express from 'express';
import mongoose from 'mongoose';

import config from '../config';
import appRoutes from '../routes/app';
import authenticationRoutes from '../routes/authentication';
import dataRoutes from '../routes/data';
import userRoutes from '../routes/user';

const originalLog = console.log;

// Overwrite the console.log function using an arrow function
console.log = (...args: any[]) => {
  const currentDate = new Date().toISOString() + ' ||';
  originalLog(currentDate, ...args);
};

class Server {
  protected app: any;

  public async run() {
    console.log(config);
    await this.connectToMongo();
    this.initilizeExpress();
  }

  private initilizeExpress() {
    // Initialize Express.
    this.app = express();
    if (
      process.env.NODE_ENV === 'development' ||
      process.env.NODE_ENV === 'test'
    ) {
      this.app.use(cors());
    }
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
    // Map routes.
    this.app.use('/api/user', userRoutes);
    this.app.use('/api/auth', authenticationRoutes);
    this.app.use('/api/app', appRoutes);
    this.app.use('/api/data', dataRoutes);

    // Start the app.
    this.app.listen(config.port, () => {
      console.log(`App listening on http://localhost:${config.port}`);
    });
  }

  private async connectToMongo() {
    console.log('Connecting to Mongo');
    // Configure promise with Bluebird and connect to MongoDB.
    mongoose.Promise = bluebird;
    await mongoose.connect(config.databaseUrl);
  }
}

const server = new Server();
server.run();
