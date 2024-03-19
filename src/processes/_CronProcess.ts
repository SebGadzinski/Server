/**
 * @file Simple Cron Process Class
 * @author Sebastian Gadzinski
 */
import { CronJob } from 'cron';
import Process, { IProcessOptions } from './_Process';

export interface ICronProcessData {
    func: () => Promise<any>;
    interval: string;
}

class CronProcess extends Process {
    public cron: ICronProcessData;

    constructor(name: string, cron: ICronProcessData, options: IProcessOptions) {
        super(name, options);
        this.cron = cron;
    }

    public async run() {
        await super.run();
        this.cronFunction();
    }

    public async test() {
        await super.run();
        await this.cron.func();
    }

    private cronFunction() {
        const job = new CronJob(
            this.cron.interval,
            async () => {
                try {
                    // Does not need to be async?
                    await this.cron.func();
                } catch (err) {
                    await this.sendAlertEmail(err);
                }
            },
            null,
            true,
            'America/Toronto'
        );

        job.start();
    }
}

export default CronProcess;
