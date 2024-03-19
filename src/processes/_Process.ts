/**
 * @file Simple Process Class
 * @author Sebastian Gadzinski
 */
import { Mail } from '@sendgrid/helpers/classes';
import bluebird from 'bluebird';
import mongoose from 'mongoose';
import config from '../config';
import EmailService from '../services/EmailService';

const originalLog = console.log;

// Overwrite the console.log function using an arrow function
console.log = (...args: any[]) => {
    const currentDate = new Date().toISOString() + ' ||';
    originalLog(currentDate, ...args);
};

export interface IProcessOptions {
    connectToDb?: boolean;
    startMessage?: string;
}

class Process {
    public name: any;
    public options: any = {};

    constructor(name: string, options?: IProcessOptions) {
        this.name = name;
        this.options = options;
    }

    public async connectToMongo() {
        console.log('Connecting to Mongo');
        // Configure promise with Bluebird and connect to MongoDB.
        mongoose.Promise = bluebird;
        await mongoose.connect(config.databaseUrl);
    }

    protected async run() {
        if (this.options.connectToDb) {
            await this.connectToMongo();
        }
        if (this.options?.startMessage) {
            console.log(this.options.startMessage);
        }
    }

    protected async sendAlertEmail(error: any) {
        const email = new Mail({
            from: config.sendGrid.email.noReply,
            to: config.sendGrid.email.alert,
            subject: this.getAlertSubject(),
            html: EmailService.errorHtml(error)
        });
        await EmailService.sendEmail(email);
    }

    private readonly getAlertSubject = () => `ALERT - ${this.name} - Database`;
}

export default Process;
