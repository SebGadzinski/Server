/**
 * @author Sebastian Gadzinski
 */

import config, { c } from '../config';
import { User, Work } from '../models';
import EmailService from '../services/EmailService';
import StripeService from '../services/StripeService';
import CronProcess from './_CronProcess';

class SubscriptionPayments extends CronProcess {
    constructor() {
        super('SubscriptionPayments',
            {
                func: () => this.subscriptionPaymentsCode(),
                interval: '0 0 */1 * * *',
            }, {
            connectToDb: true,
            startMessage: 'Subscription Payments Running...'
        });
    }

    private async subscriptionPaymentsCode() {
        const currentDate = new Date();
        // Query only those works where the last subscription in the array meets the criteria
        const worksToBill = await Work.find({
            status: c.WORK_STATUS_OPTIONS.SUBSCRIBED,
            $expr: {
                $let: {
                    vars: {
                        lastSubscription: { $arrayElemAt: ['$subscription', -1] }
                    },
                    in: {
                        $and: [
                            { $lte: ['$$lastSubscription.nextPayment', currentDate] },
                            { $lt: ['$$lastSubscription.dateDisabled', '$$lastSubscription.dateActivated'] }
                        ]
                    }
                }
            }
        });

        for (const work of worksToBill) {
            const userToBill = await User.findById(work.userId).lean();
            let last4Digits = 'Unknown';
            try {
                const subscription = work.subscription[work.subscription.length - 1];
                last4Digits = await StripeService.getLast4DigitsOfCard(work.categorySlug, subscription.paymentMethodId);
                await StripeService.processSubscriptionPayment(userToBill, work);
            } catch (err) {
                // Update work to halted due to subscription payment not processed?
                work.status = c.WORK_STATUS_OPTIONS.PAYMENTS_FAILED;
                work.save();
                console.error(`Error processing subscription for work ID ${work._id}: ${err}`);
                await this.sendErrorEmail(err, work, userToBill.email, last4Digits);
            }
        }
    }

    private async sendErrorEmail(err: Error, subscription: any, billingUserEmail: string, last4Digits: string) {
        const alertBody = `
        <div>
            <h2>Subscription Details</h2>
            <ul>
                <li><strong>Payment:</strong> <span id="payment">${subscription.payment}</span></li>
                <li><strong>Interval:</strong> <span id="interval">${subscription.interval}</span></li>
                <li><strong>Created Date:</strong> <span id="createdDate">${subscription.createdDate}</span></li>
                <li><strong>Date Activated:</strong> <span id="dateActived">${subscription.dateActived}</span></li>
            </ul>
            <h2>Card On File</h2>
            <ul>
                <li><span>************</span><strong>${last4Digits}</strong></li>
            </ul>
        </div>`;
        // Send user email
        await EmailService.sendAlertEmail(billingUserEmail, 'Subscription Payment Failed', alertBody);
        // Send owner email
        const adminAlertBodyStart = `
        <div>
            <h2>Customer</h2>
            <ul>
                <li><strong>email:</strong> <span id="interval">${billingUserEmail}</span></li>
            </ul>
            <h2>Error</h2>
            <ul>
                <li>${err.toString()}</li>
            </ul>
        </div>
        `;
        await EmailService.sendAlertEmail(config.sendGrid.email.alert,
            'Subscription Payment Failed', adminAlertBodyStart + alertBody);
    }

}

const subscriptionPayments = new SubscriptionPayments();
subscriptionPayments.run();
