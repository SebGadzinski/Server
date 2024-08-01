/**
 * @file Work Payment related functionality.
 * @author Sebastian Gadzinski
 */

import mongoose from 'mongoose';
import { c } from '../config';
import { Category, User, Work, Worker } from '../models';
import { IUser } from '../models/User';
import { IPaymentHistory, IWork } from '../models/Work';
import CSGeneratorService from './CSGeneratorService';
import EmailService from './EmailService';
import SubscriptionService from './SubscriptionService';

export interface IPaymentDetails {
    amount: number;
    name: string;
    newPaymentHistory: any;
}

export interface IConfirmationPaymentDetails {
    paymentHistory: IPaymentHistory;
    work: IWork;
    workUser: IUser;
}

class WorkPaymentService {
    public static getInstance(): WorkPaymentService {
        if (!WorkPaymentService.instance) {
            WorkPaymentService.instance = new WorkPaymentService();
        }
        return WorkPaymentService.instance;
    }

    private static instance: WorkPaymentService;

    public getPaymentDetails(paymentData, work: IWork): IPaymentDetails {
        const details = {
            amount: 0,
            name: '',
            newPaymentHistory: null
        };
        const paymentCompletedMsg = `Payment already completed`;

        if (paymentData.type === c.PAYMENT_HISTORY_TYPE.CONFIRMATION) {
            if (work.initialPaymentStatus === c.PAYMENT_STATUS_OPTIONS.COMPLETED) {
                throw new Error(paymentCompletedMsg);
            }
            details.amount = work.initialPayment;
            details.name = 'Initial Payment for Work ID ' + paymentData.workId;
        } else if (paymentData.type === c.PAYMENT_HISTORY_TYPE.PAYMENT_ITEM && paymentData.paymentItemId) {
            // Get the payment item and add it name
            const paymentItem = work.paymentItems.find(
                (x) => x._id.toString() === paymentData.paymentItemId
            );
            if (!paymentItem) {
                throw new Error(`No payment item found ${paymentData.paymentItemId}`);
            }
            if (paymentItem.status === c.PAYMENT_STATUS_OPTIONS.COMPLETED) {
                throw new Error(paymentCompletedMsg);
            }
            details.name = `Payment '${paymentItem.name}' for Work ID ${paymentData.workId}`;
            details.amount = paymentItem.payment;
        } else if (paymentData.type === c.PAYMENT_HISTORY_TYPE.FULL) {
            const unpaidPaymentItems = work.paymentItems.filter(
                (x) => x.status !== c.PAYMENT_STATUS_OPTIONS.COMPLETED
            );
            if (unpaidPaymentItems.length === 0) {
                throw new Error(paymentCompletedMsg);
            }
            const payments = [];
            details.amount = unpaidPaymentItems.reduce((total, currentItem) => {
                payments.push(`${currentItem.name} : ${currentItem.payment.toFixed(2)} CAD`);
                return total + currentItem.payment;
            }, 0);
            details.name = `Payments: ${JSON.stringify(payments)} for Work ID ` + paymentData.workId;
        } else if (paymentData.type === c.PAYMENT_HISTORY_TYPE.CANCELLATION) {
            if (work.cancellationPaymentStatus === c.PAYMENT_STATUS_OPTIONS.COMPLETED) {
                throw new Error(paymentCompletedMsg);
            }
            details.amount = work.cancellationPayment;
            details.name = 'Cancellation Payment for Work ID ' + paymentData.workId;
        } else {
            throw new Error('Endpoint not found');
        }

        // Create a new Payment History
        details.newPaymentHistory = {
            _id: new mongoose.Types.ObjectId(),
            type: paymentData.type,
            sessionId: '',
            status: 'New',
            createdDate: new Date()
        };

        if (paymentData.paymentItemId) {
            details.newPaymentHistory.paymentItemId = paymentData.paymentItemId;
        }

        details.amount = Number(details.amount.toFixed(2));

        return details;
    }

    public async getConfirmationPaymentDetails(paymentHistoryId: string): Promise<IConfirmationPaymentDetails> {
        if (!paymentHistoryId) throw new Error('Payement History ID is required');

        const matchQuery: any = {
            $expr: {
                $in: [
                    { $toObjectId: paymentHistoryId },
                    {
                        $map: {
                            input: '$paymentHistory',
                            as: 'payment',
                            in: '$$payment._id'
                        }
                    }
                ]
            }
        };

        const work = await Work.findOne(matchQuery);
        if (!work) {
            throw new Error('No Work Found');
        }

        const workUser = await User.findOne({ _id: work.userId });
        if (!workUser) throw new Error('User not found');

        // Get the payment history object from the list
        const paymentHistory = work.paymentHistory.find(
            (ph) => ph._id.toString() === paymentHistoryId
        );
        if (!paymentHistory) {
            throw new Error('Payment History Not Found');
        }
        return { work, workUser, paymentHistory };
    }

    public async afterPaymentProcess(
        user: IUser, work: IWork, paymentHistory: IPaymentHistory, amount: number, last4DigitsOfCard: string
    ) {
        paymentHistory.status = c.PAYMENT_STATUS_OPTIONS.COMPLETED;
        const transactionItems = [];

        // Update the statuses of content of work
        if (paymentHistory.type === c.PAYMENT_HISTORY_TYPE.CONFIRMATION) {
            work.status = c.WORK_STATUS_OPTIONS.USER_ACCEPTED;

            // CUSTOM PURCHASES
            await CSGeneratorService.addTokens(work, user);

            work.initialPaymentStatus = c.PAYMENT_STATUS_OPTIONS.COMPLETED;
            if (work?.subscription?.length > 0) {
                let sub = work?.subscription[work.subscription.length - 1];
                sub = SubscriptionService.completeSubscription(sub);
                work.status = c.WORK_STATUS_OPTIONS.SUBSCRIBED;
                work.completeSubscription = undefined;
            }

            transactionItems.push({
                name: 'Initial Payment',
                quantity: 1,
                price: `${work.initialPayment.toFixed(2)} CAD`
            });

            const workers = await Worker.getWorkers(work.categorySlug, work.serviceSlug);
            await EmailService.sendConfirmWorkEmails(work, user, workers);
        } else if (
            paymentHistory.type === c.PAYMENT_HISTORY_TYPE.PAYMENT_ITEM &&
            paymentHistory?.paymentItemId
        ) {
            const paymentItem = work.paymentItems.find(
                (pi) => pi._id.toString() === paymentHistory.paymentItemId
            );
            if (paymentItem) {
                paymentItem.status = c.PAYMENT_STATUS_OPTIONS.COMPLETED;
                transactionItems.push({
                    name: paymentItem.name,
                    quantity: 1,
                    price: `${paymentItem.payment.toFixed(2)} CAD`
                });
            }
        } else if (paymentHistory.type === c.PAYMENT_HISTORY_TYPE.FULL) {
            for (const payment of work.paymentItems) {
                if (payment.status !== c.PAYMENT_STATUS_OPTIONS.COMPLETED) {
                    payment.status = c.PAYMENT_STATUS_OPTIONS.COMPLETED;
                    transactionItems.push({
                        name: payment.name,
                        quantity: 1,
                        price: `${payment.payment.toFixed(2)} CAD`
                    });
                }
            }
        } else if (paymentHistory.type === c.PAYMENT_HISTORY_TYPE.CANCELLATION) {
            work.status = c.WORK_STATUS_OPTIONS.CANCELLED;
            work.cancellationPaymentStatus = c.PAYMENT_STATUS_OPTIONS.COMPLETED;
            transactionItems.push({
                name: 'Cancellation',
                quantity: 1,
                price: `${work.cancellationPayment.toFixed(2)} CAD`
            });

            // if this is a subscription it should set to off
            const subsLength = work?.subscription?.length;
            if (subsLength > 0) {
                const sub = work.subscription[subsLength - 1];
                sub.dateDisabled = new Date();
            }

            const workers = await Worker.getWorkers(work.categorySlug, work.serviceSlug);
            await EmailService.sendCancelWorkEmails(work, user, workers);
        } else {
            throw new Error(`Type ${paymentHistory.type} not found`);
        }

        await work.save();

        const transactionDetails = {
            date: new Date().toISOString().split('T')[0], // Current date in YYYY-MM-DD format
            amount,
            items: transactionItems,
        };

        // Gather meta data
        const names = await Category.getNames(work.categorySlug, work.serviceSlug);
        const metaData = {
            workId: work._id,
            category: names.category,
            service: names.service
        };

        // Send receipt email
        await EmailService.sendReceiptEmail({
            to: user.email,
            metaData,
            transactionDetails,
            paymentMethod: `**** **** **** ${last4DigitsOfCard}`,
            transactionId: paymentHistory._id.toString()
        });

    }
}

export default WorkPaymentService.getInstance();
