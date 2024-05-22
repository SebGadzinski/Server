import _ from 'lodash';
import { Result } from '../classes';
import { c } from '../config';
import {
    Category,
    User, Work
} from '../models';
import {
    SecurityService,
    StripeService,
    WorkPaymentService,
} from '../services';

class WorkPaymentController {
    public async generateAttachedCardPaymentIntent(req: any, res: any) {
        try {
            if (!req?.body?.workId) throw new Error('Work ID is required');

            const work = await Work.findOne({ _id: req.body.workId });
            await Work.acceptingWork(work.categorySlug, work.serviceSlug);

            if (
                !req.user.data.roles.includes('admin') &&
                req.user.data.id !== work.userId.toString()
            ) {
                // if not admin and not this user send an error
                await SecurityService.accessDenied(req.ip);
                return;
            }

            const user = await User.findById(req.user.data.id);
            const details = WorkPaymentService.getPaymentDetails(req.body, work);
            await StripeService.payViaAttachedCard(user, work, details);

            res.send(
                new Result({
                    data: {},
                    success: true
                })
            );
        } catch (err) {
            res.send(new Result({ message: err.message, success: false }));
        }
    }

    public async confirmAttachedCardPaymentIntent(req: any, res: any) {
        try {
            const { work, paymentHistory } = await WorkPaymentService.getConfirmationPaymentDetails(req?.query?.id);

            const paymentIntent = await StripeService.getPaymentIntent(paymentHistory.intentId, work.categorySlug);
            if (paymentIntent.status !== 'succeeded') {
                throw new Error('Payment not successful');
            }

            res.send(new Result({ data: work._id, success: true }));
        } catch (err) {
            res.send(new Result({ message: err.message, success: false }));
        }
    }

    public async generateSessionPaymentIntent(req: any, res: any) {
        try {
            if (!req?.body?.workId) throw new Error('Work ID is required');

            const work = await Work.findOne({ _id: req.body.workId });
            await Work.acceptingWork(work.categorySlug, work.serviceSlug);

            if (work?.subscription?.length > 0) {
                const sub = work.subscription[work.subscription.length - 1];
                if ((!sub.dateDisabled || sub.dateDisabled < sub.dateActivated)
                    && !sub.paymentMethodId) {
                    throw new Error('Please provide a payment method');
                }
            }

            if (
                !req.user.data.roles.includes('admin') &&
                req.user.data.id !== work.userId.toString()
            ) {
                // if not admin and not this user send an error
                await SecurityService.accessDenied(req.ip);
                return;
            }

            const { amount, name, newPaymentHistory } = WorkPaymentService.getPaymentDetails(req.body, work);
            const session = await StripeService.createCheckoutSession(work, 'cad', name, amount, newPaymentHistory);

            newPaymentHistory.sessionId = session.id;
            work.paymentHistory.push(newPaymentHistory);
            work.save();

            res.send(
                new Result({
                    data: { sessionId: session.id, url: session.url },
                    success: true
                })
            );
        } catch (err) {
            res.send(new Result({ message: err.message, success: false }));
        }
    }

    public async confirmSessionPaymentIntent(req: any, res: any) {
        try {
            const { work, paymentHistory, workUser } = await WorkPaymentService.getConfirmationPaymentDetails(req?.query?.id);

            const checkoutSession = await StripeService.getCheckoutSession(work.categorySlug, paymentHistory.sessionId);

            if (checkoutSession.payment_status !== 'paid') {
                throw new Error('Payment not successful');
            }

            const card = await StripeService.getLast4DigitsOfCardFromSession(work.categorySlug, checkoutSession);
            const amount = Number((checkoutSession.amount_total / 100).toFixed(2));

            await WorkPaymentService.afterPaymentProcess(workUser, work, paymentHistory, amount, card);

            res.send(new Result({ data: work._id, success: true }));
        } catch (err) {
            res.send(new Result({ message: err.message, success: false }));
        }
    }

    public async getSubPaymentHistory(req: any, res: any) {
        try {
            if (!req?.body?.workId) throw new Error('Work ID is required');

            const work = await Work.findById(req.body.workId, { userId: 1, categorySlug: 1 });
            // if not admin and not this user send a error
            if (
                !req?.user?.data.roles.includes('admin') &&
                req?.user?.data?.id !== work.userId.toString()
            ) {
                await SecurityService.accessDenied(req.ip);
            }

            // Get more Payment History from the index if given one
            const indexSlip = req.body?.paymentHistoryIndex ?? 0;
            const paymentHistory = await Work.getMoreSubPaymentHistory(req?.body.workId,
                indexSlip, c.LOADING_MORE.PAYMENT_HISTORY);

            // TODO Make sure this works
            const data = await StripeService.getSubPaymentHistory(paymentHistory, work.categorySlug);

            res.send(new Result({ success: true, data }));
        } catch (err) {
            res.send(new Result({ message: err.message, success: false }));
        }
    }

    public async addCardToSubscription(req: any, res: any) {
        try {
            if (!req?.body?.workId) throw new Error('Work ID is required');
            if (!req?.body?.cardToken) throw new Error('Card Token is required');

            const work = await Work.findById(req.body.workId);
            // if not admin and not this user send a error
            if (
                !req?.user?.data.roles.includes('admin') &&
                req?.user?.data?.id !== work.userId.toString()
            ) {
                await SecurityService.accessDenied(req.ip);
            }

            const user = await User.findById(work.userId).lean();

            const paymentId = await StripeService.addCard(user, work.categorySlug, req.body.cardToken);
            work.subscription[work.subscription.length - 1].paymentMethodId = paymentId;
            await work.save();

            res.send(new Result({ success: true }));
        } catch (err) {
            res.send(new Result({ message: err.message, success: false }));
        }
    }

    public async confirmSubPaymentIntent(req: any, res: any) {
        try {
            if (!req?.query?.id) throw new Error('Payement Intent ID is required');

            res.send(new Result({ data: 'Contact our developer team', success: true }));
        } catch (err) {
            res.send(new Result({ message: err.message, success: false }));
        }
    }

    public async deleteCard(req: any, res: any) {
        try {
            if (!req?.params?.id) throw new Error('Work ID is required');

            const work = await Work.findById(req.params.id);
            // if not admin and not this user send a error
            if (
                !req?.user?.data.roles.includes('admin') &&
                req?.user?.data?.id !== work.userId.toString()
            ) {
                await SecurityService.accessDenied(req.ip);
            }

            const sub = work.subscription[work.subscription.length - 1];
            await StripeService.removeCard(work.categorySlug, sub.paymentMethodId);
            sub.paymentMethodId = undefined;
            await work.save();

            res.send(new Result({ success: true }));
        } catch (err) {
            res.send(new Result({ message: err.message, success: false }));
        }
    }

    public async generatePaymentReceipt(req: any, res: any) {
        try {
            const id = req?.params?.id; // Correctly access the id from path parameters
            const work = await Work.findById(id);

            if (!work) {
                throw new Error('No Work Found');
            }

            if (
                !req?.user?.data.roles.includes('admin') &&
                req?.user?.data?.id !== work.userId.toString()
            ) {
                await SecurityService.accessDenied(req.ip);
            }

            const names = await Category.getNames(work.categorySlug, work.serviceSlug);

            const receipt: any = {
                metaData: {
                    workId: work._id,
                    category: names.category,
                    service: names.service,
                    createdOn: new Date()
                },
                checkouts: [],
                subs: [],
                totals: {
                    checkout: 0,
                    sub: 0,
                    toDate: 0
                },
            };

            // Generate payments from work.paymentHistory
            for (const payment of work.paymentHistory
                .filter((x) => x.status === c.PAYMENT_STATUS_OPTIONS.COMPLETED)) {
                if (payment.intentId) {
                    const paymentIntent = await StripeService.getPaymentIntent(payment.intentId, work.categorySlug);
                    if (paymentIntent.status === 'succeeded') {
                        const amount = Number((paymentIntent.amount / 100).toFixed(2));
                        const items = [{
                            description: paymentIntent.description,
                            total: `${amount.toFixed(2)} CAD`,
                        }];
                        const paymentMethod = await StripeService
                            .getLast4DigitsOfCard(work.categorySlug, paymentIntent.payment_method.toString());
                        receipt.totals.checkout += amount;
                        receipt.checkouts.push({
                            id: payment._id,
                            payment: `${amount.toFixed(2)} CAD`,
                            items,
                            paymentMethod: `**** **** **** ${paymentMethod}`,
                            date: payment.createdDate
                        });
                    }
                } else if (payment.sessionId) {
                    const session = await StripeService
                        .getCheckoutSession(work.categorySlug, payment.sessionId);
                    if (session.payment_status === 'paid') {
                        const lineItemResponse: any = await StripeService
                            .getLineItems(work.categorySlug, payment.sessionId);
                        const items = lineItemResponse.data.map((x) => {
                            const itemAmount = Number((x.amount_total / 100).toFixed(2));
                            return {
                                description: x.description,
                                total: `${itemAmount.toFixed(2)} CAD`,
                            };
                        });
                        const amount = Number((session.amount_total / 100).toFixed(2));
                        receipt.totals.checkout += amount;
                        const paymentMethod = await StripeService
                            .getLast4DigitsOfCardFromSession(work.categorySlug, session);
                        receipt.checkouts.push({
                            id: payment._id,
                            payment: `${amount.toFixed(2)} CAD`,
                            items,
                            paymentMethod: `**** **** **** ${paymentMethod}`,
                            date: payment.createdDate
                        });
                    }
                }
            }

            if (work.subscription?.length > 0) {
                for (const sub of work.subscription) {
                    const subPaymentData = await StripeService
                        .getSubPaymentHistory(sub.paymentHistory, work.categorySlug);
                    for (const paymentInfo of subPaymentData) {
                        receipt.totals.sub += paymentInfo.cost;
                        receipt.subs.push({
                            id: paymentInfo.id,
                            payment: `${paymentInfo.cost.toFixed(2)} CAD`,
                            paymentMethod: `**** **** **** ${paymentInfo.last4Digits}`,
                            date: paymentInfo.date
                        });
                    }
                }
            }

            receipt.totals.toDate = receipt.totals.checkout + receipt.totals.sub;

            receipt.totals.checkout = `${receipt.totals.checkout.toFixed(2)} CAD`;
            receipt.totals.sub = `${receipt.totals.sub.toFixed(2)} CAD`;
            receipt.totals.toDate = `${receipt.totals.toDate.toFixed(2)} CAD`;

            res.send(new Result({ data: receipt, success: true }));
        } catch (err) {
            res.send(new Result({ message: err.message, success: false }));
        }
    }
}

export default new WorkPaymentController();
