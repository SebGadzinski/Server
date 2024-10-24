/**
 * @file Stipe Service related functionality based off category.
 * @author Sebastian Gadzinski
 */

import axios from 'axios';
import mongoose from 'mongoose';
import querystring from 'querystring';
import Stripe from 'stripe';
import config, { c } from '../config';
import { Category } from '../models';
import { IUser } from '../models/User';
import Work, { IWork } from '../models/Work';
import EmailService from '../services/EmailService';
import SubscriptionService from './SubscriptionService';
import WorkPaymentService, { IPaymentDetails } from './WorkPaymentService';

const stripe = {
    classes: new Stripe(config.stripe.classes, {
        apiVersion: '2023-10-16'
    }),
    software: new Stripe(config.stripe.software, {
        apiVersion: '2023-10-16'
    }),
    photography: new Stripe(config.stripe.photography, {
        apiVersion: '2023-10-16'
    }),
    videography: new Stripe(config.stripe.videography, {
        apiVersion: '2023-10-16'
    }),
    design: new Stripe(config.stripe.design, {
        apiVersion: '2023-10-16'
    }),
};

class StripeService {
    public static getInstance(): StripeService {
        if (!StripeService.instance) {
            StripeService.instance = new StripeService();
        }
        return StripeService.instance;
    }

    private static instance: StripeService;

    public async createCustomer(user: IUser, categorySlug: string): Promise<any> {
        const stripeAccount = stripe[categorySlug];

        // Search for existing customers with the same email
        const existingCustomers = await stripeAccount.customers.list({
            email: user.email,
            limit: 1 // Assuming you want to check the first match
        });

        // Check if a customer already exists
        if (existingCustomers.data.length > 0) {
            // Customer already exists, so you might return this customer
            // or handle it as per your business logic
            return existingCustomers.data[0];
        } else {
            // Create a new customer if not found
            const customer = await stripeAccount.customers.create({
                email: user.email,
                name: user.fullName
            });
            return customer;
        }
    }

    public async addCard(user: IUser, categorySlug: string, cardToken: string): Promise<any> {
        const stripeAccount = stripe[categorySlug];
        if (!stripeAccount) {
            throw new Error(`Invalid category slug: ${categorySlug}`);
        }

        let customer = await this.findStripeCustomer(user.email, stripeAccount);
        if (!customer) {
            customer = await this.createCustomer(user, categorySlug);
        }

        try {
            // Convert the token to a PaymentMethod
            const paymentMethod = await stripeAccount.paymentMethods.create({
                type: 'card',
                card: { token: cardToken },
            });

            // Attach the PaymentMethod to the customer
            await stripeAccount.paymentMethods.attach(paymentMethod.id, {
                customer: customer.id,
            });

            return paymentMethod.id;
        } catch (err) {
            console.error(`Error adding card for user ID ${user._id}: ${err}`);
            throw err;
        }
    }

    public async removeCard(categorySlug: string, paymentMethodId: string): Promise<void> {
        const stripeAccount = stripe[categorySlug];
        if (!stripeAccount) {
            throw new Error(`Invalid category slug: ${categorySlug}`);
        }
        try {
            await stripeAccount.paymentMethods.detach(paymentMethodId);
        } catch (err) {
            console.error(`Error removing paymentMethod: ${paymentMethodId}: ${err}`);
            throw err;
        }
    }

    public async processSubscriptionPayment(user: IUser, work: IWork): Promise<any> {
        const subscription = work.subscription[work.subscription.length - 1];
        const stripeAccount = stripe[work.categorySlug];
        if (!stripeAccount) {
            throw new Error(`Invalid category slug: ${work.categorySlug}`);
        }

        try {
            const customer = await this.findStripeCustomer(user.email, stripeAccount);
            if (!customer) {
                throw new Error('Customer not found');
            }

            const paymentMethod = await stripeAccount.paymentMethods.retrieve(
                subscription.paymentMethodId
            );

            const newPaymentHistory: any = {
                _id: new mongoose.Types.ObjectId(),
                status: c.PAYMENT_STATUS_OPTIONS.NEW,
                paymentIntentId: 'new',
            };

            subscription.paymentHistory.push(newPaymentHistory);
            await work.save();

            // Complete the payment with Stripe
            const paymentIntent = await stripeAccount.paymentIntents.create({
                amount: subscription.payment * 100, // Convert to cents
                currency: 'cad',
                customer: customer.id,
                payment_method: paymentMethod.id, // Using the default payment method
                confirm: true,
                return_url: `${config.domain}/api/work/sub/pay/confirm?id=${newPaymentHistory._id}`
            });
            // Update the newPaymentHistory item in the subscription
            const paymentHistoryIndex = subscription.paymentHistory.findIndex((ph) => ph._id === newPaymentHistory._id);
            subscription.paymentHistory[paymentHistoryIndex].paymentIntentId = paymentIntent.id;
            subscription.paymentHistory[paymentHistoryIndex].status = paymentIntent.status === 'succeeded'
                ? c.PAYMENT_STATUS_OPTIONS.COMPLETED
                : c.PAYMENT_STATUS_OPTIONS.FAILED;

            subscription.nextPayment = SubscriptionService.addIntervalToDate(
                subscription.nextPayment, subscription.interval);
            await work.save();

            if (paymentIntent.status !== 'succeeded') {
                throw new Error('Payment not successful');
            }

            // Prepare transaction details for the receipt email
            const transactionDetails = {
                date: new Date(paymentIntent.created * 1000).toISOString().split('T')[0],
                amount: subscription.payment,
                items: [
                    {
                        name: `Subscription for ${work.categorySlug} - ${work.serviceSlug} - ${work._id}`,
                        quantity: 1,
                        price: `${subscription.payment.toFixed(2)} CAD`,
                    },
                ],
            };

            // Gather meta data
            const names = await Category.getNames(work.categorySlug, work.serviceSlug);
            const metaData = {
                workId: work._id,
                category: names.category,
                service: names.service
            };

            const card = await this.getLast4DigitsOfCard(
                work.categorySlug, subscription.paymentMethodId);

            // Send a subscription payment email
            await EmailService.sendReceiptEmail({
                to: user.email,
                metaData,
                transactionDetails,
                paymentMethod: `**** **** **** ${card}`,
                transactionId: newPaymentHistory._id.toString()
            });
        } catch (err) {
            console.error(`Error processing payment for work ID ${work._id}: ${err}`);
            throw err;
        }
    }

    public async payViaAttachedCard(user: IUser, work: IWork, details: IPaymentDetails): Promise<any> {
        const stripeAccount = stripe[work.categorySlug];
        if (!stripeAccount) {
            throw new Error(`Invalid category slug: ${work.categorySlug}`);
        }

        try {
            let customer = await this.findStripeCustomer(user.email, stripeAccount);
            if (!customer) {
                customer = await this.createCustomer(user, work.categorySlug);
            }

            // Validate Subscription exists
            if (work?.subscription?.length < 1) throw new Error('No Subscription Found');
            const sub = work.subscription[work.subscription.length - 1];
            if ((!sub.dateDisabled || sub.dateDisabled < sub.dateActivated)
                && !sub.paymentMethodId) {
                throw new Error('Please provide a payment method');
            }

            const paymentMethod = await stripeAccount.paymentMethods.retrieve(
                sub.paymentMethodId
            );
            const paymentAmount = Number((details.amount * 100).toFixed(2));

            const paymentIntent = await stripeAccount.paymentIntents.create({
                amount: paymentAmount,
                currency: 'cad',
                customer: customer.id,
                payment_method: paymentMethod.id,
                confirm: true,
                return_url: `${config.domain}/api/work/pay/attached-card/confirm?id=${details.newPaymentHistory._id}`,
                description: `${details.name}`
            });

            details.newPaymentHistory.intentId = paymentIntent.id;
            if (paymentIntent.status !== 'succeeded') {
                details.newPaymentHistory.status = c.PAYMENT_STATUS_OPTIONS.FAILED;
                work.paymentHistory.push(details.newPaymentHistory);
                await work.save();
                throw new Error('Payment not successful');
            } else {
                details.newPaymentHistory.status = c.PAYMENT_STATUS_OPTIONS.COMPLETED;
                work.paymentHistory.push(details.newPaymentHistory);
                await work.save();
                await WorkPaymentService.afterPaymentProcess(user, work,
                    work.paymentHistory[work.paymentHistory.length - 1],
                    details.amount, paymentMethod.card.last4);
            }
        } catch (err) {
            console.error(`Error processing payment for work ID ${work._id}: ${err}`);
            throw err;
        }
    }

    public async createCheckoutSession(
        work: IWork, currency: string, name: string, amount: number, newPaymentHistory: any)
        : Promise<Stripe.Checkout.Session> {
        const stripeAccount = stripe[work.categorySlug];
        if (!stripeAccount) {
            throw new Error(`Invalid category slug: ${work.categorySlug}`);
        }

        const session = await stripeAccount.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [{
                price_data: {
                    currency,
                    product_data: {
                        name
                    },
                    unit_amount: Math.round(amount * 100)
                },
                quantity: 1
            }],
            mode: 'payment',
            success_url: `${config.frontEndDomain}/work/pay/confirm/${newPaymentHistory._id}`,
            cancel_url: `${config.frontEndDomain}/work`
        });

        return session;
    }

    public async getCheckoutSession(categorySlug: string, sessionId: string): Promise<Stripe.Checkout.Session> {
        return await stripe[
            categorySlug
        ].checkout.sessions.retrieve(sessionId);
    }

    // If its over 100 ill be suprised
    public async getLineItems(categorySlug: string, sessionId: string): Promise<Stripe.LineItem[]> {
        return await stripe[categorySlug].checkout.sessions.listLineItems(sessionId, {
            limit: 100
        });
    }

    public async getLast4DigitsOfCard(categorySlug: string, paymentMethodId: string): Promise<string> {
        const stripeAccount = stripe[categorySlug];

        // Retrieve the default payment method
        const paymentMethod = await stripeAccount.paymentMethods.retrieve(
            paymentMethodId
        );

        if (!paymentMethod) {
            throw new Error('No Card Found');
        }

        // Extract the last four digits of the card
        return paymentMethod.card.last4;
    }

    public async getLast4DigitsOfCardFromSession(categorySlug: string, session: Stripe.Checkout.Session)
        : Promise<string> {
        const stripeAccount = stripe[categorySlug];

        // Retrieve the default payment method
        const paymentIntentId = session.payment_intent;
        const paymentIntent = await stripeAccount.paymentIntents.retrieve(paymentIntentId);

        if (!paymentIntent) {
            throw new Error('No Card Found');
        }

        // Extract the last four digits of the card
        return this.getLast4DigitsOfCard(categorySlug, paymentIntent.payment_method);
    }

    public async getSubPaymentHistory(paymentHistory: any, categorySlug: string):
        Promise<Array<{ id: any; date: Date, cost: number, last4Digits: string }>> {
        const result: Array<{ id: any; date: Date; cost: number; last4Digits: string }> = [];
        const stripeAccount = stripe[categorySlug];

        if (paymentHistory && paymentHistory.length > 0) {
            for (const payment of paymentHistory) {
                const data = await stripeAccount.paymentIntents.retrieve(payment.paymentIntentId);
                if (data.status === 'succeeded') {
                    const last4Digits = await this.getLast4DigitsOfCard(categorySlug, data.payment_method);
                    result.push({
                        id: payment._id,
                        date: new Date(data.created * 1000),
                        cost: Number((data.amount / 100).toFixed(2)),
                        last4Digits
                    });
                }
            }
        }

        return result;
    }

    public async getPaymentIntent(paymentIntentId: string, categorySlug: string): Promise<Stripe.PaymentIntent | null> {
        return await stripe[
            categorySlug
        ].paymentIntents.retrieve(paymentIntentId);
    }

    private async findStripeCustomer(userEmail: string, stripeAccount: Stripe): Promise<Stripe.Customer | null> {
        const customers = await stripeAccount.customers.search({
            query: `email:'${userEmail}'`
        });

        if (customers.data.length > 0) {
            return customers.data[0]; // Assuming the first result is the correct customer
        } else {
            return null;
        }
    }

}

export default StripeService.getInstance();
