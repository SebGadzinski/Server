/**
 * @file Subscription functionality.
 * @author Sebastian Gadzinski
 */

import { DateTime } from 'luxon';

class SubscriptionService {
    public static getInstance(): SubscriptionService {
        if (!SubscriptionService.instance) {
            SubscriptionService.instance = new SubscriptionService();
        }
        return SubscriptionService.instance;
    }

    private static instance: SubscriptionService;

    public addIntervalToDate(dateInput: Date, interval: string): Date {
        let date = DateTime.fromJSDate(dateInput);

        switch (interval) {
            case '7 Days':
                date = date.plus({ days: 7 });
                break;
            case '1 Months':
                date = date.plus({ months: 1 });
                break;
            case '1 Years':
                date = date.plus({ years: 1 });
                break;
            default:
                throw new Error(`Invalid interval. Valid intervals are '7 Days', '1 Month', '1 Year'.`);
        }

        return date.toJSDate();
    }

    public completeSubscription(subscription: any): any {
        const curDate = new Date();
        subscription.nextPayment = this.addIntervalToDate(curDate, subscription.interval);
        subscription.createdDate = curDate;
        subscription.dateActivated = curDate;
        return subscription;
    }

    public isEnabled(subscription: any): boolean {
        if (!subscription?.dateDisabled) {
            return subscription?.dateActivated !== null;
        } else {
            return subscription.dateDisabled < subscription.dateActivated;
        }
    }

}

export default SubscriptionService.getInstance();
