import _ from 'lodash';
import { Result } from '../classes';
import { c } from '../config';
import {
    Category,
    WorkTemplate
} from '../models';
import {
    MongoUtilService,
    SecurityService
} from '../services';

class WorkTemplateController {

    public async saveWorkTemplate(req: any, res: any) {
        try {
            if (!req?.body?.name) {
                throw new Error('Name Required');
            }

            const work = MongoUtilService.stripMongo(req.body.work ?? req?.body?.template);
            function deleteId(obj) {
                if (obj?._id) {
                    delete obj._id;
                }
                return obj;
            }
            work.workItems = work.workItems.map((x) => deleteId(x));
            work.paymentItems = work.paymentItems.map((x) => deleteId(x));

            const saveBy = {
                name: req.body.name,
                category: work.category,
                service: work.service,
            };

            if (req?.body?.work) {
                if (work.payment?.subscription) {
                    work.payment.subscription = deleteId(work.payment?.subscription);
                }
                await WorkTemplate.updateOne(
                    saveBy,
                    {
                        name: req.body.name,
                        category: work.category,
                        service: work.service,
                        workItems: work.workItems,
                        paymentItems: work.paymentItems,
                        subscription: work.payment?.subscription ? {
                            payment: work.payment.subscription.payment,
                            interval: work.payment.subscription.interval,
                        } : null,
                        initialPayment: work.payment.initialPayment,
                        initialPaymentStatus: work.initialPaymentStatus,
                        cancellationPayment: work.payment.cancellationPayment,
                        cancellationPaymentStatus: work.cancellationPaymentStatus,
                        status: work.status,
                        classType: work.classType
                    },
                    { upsert: true });
            } else if (req?.body?.template) {
                if (work?.subscription) {
                    work.subscription = deleteId(work.subscription);
                }
                work.name = req.body.name;
                await WorkTemplate.updateOne(
                    saveBy,
                    work,
                    { upsert: true });
            } else {
                throw new Error('No object found');
            }

            res.send(new Result({ success: true }));
        } catch (err) {
            res.send(new Result({ message: err.message, success: false }));
        }
    }

    public async getWorkTemplatePageData(req: any, res: any) {
        try {
            const templates = await WorkTemplate.find({}).lean();

            res.send(new Result({
                data: templates, success: true
            }));
        } catch (err) {
            res.send(new Result({ message: err.message, success: false }));
        }
    }

    public async getWorkTemplateComponent(req: any, res: any) {
        try {
            if (!req?.body?.id) {
                throw new Error('No id found');
            }

            const template: any = await WorkTemplate.findById(req.body.id).lean();

            const slugs = await Category.getSlugs(template.category, template.service);
            template.categorySlug = slugs.categorySlug;
            template.serviceSlug = slugs.serviceSlug;

            res.send(new Result({
                data: template, success: true
            }));
        } catch (err) {
            res.send(new Result({ message: err.message, success: false }));
        }
    }

    public async getWorkTemplateEditorPageData(req: any, res: any) {
        try {
            // Have to be a editor to be here
            if (!req?.user?.data.roles.includes('admin')) {
                await SecurityService.accessDenied(req.ip);
            }

            const data: any = {
                categoryOptions: (await Category.find({}, { name: 1 })).map(
                    (x) => x.name
                ),
                servicesOptions: await Category.aggregate([
                    { $group: { _id: '$name', services: { $push: '$services.name' } } },
                    { $project: { _id: 0, name: '$_id', services: 1 } }
                ]).then((results) => {
                    // Create a dictionary from the results
                    const servicesDict = {};
                    results.forEach((item) => {
                        servicesDict[item.name] = item.services;
                    });
                    return servicesDict;
                }),
                workStatusOptions: _.values(c.WORK_STATUS_OPTIONS),
                classTypeOptions: _.values(c.CLASS_TYPE),
                paymentStatusOptions: _.values(c.PAYMENT_STATUS_OPTIONS),
                subscriptionIntervalOptions: _.values(c.SUBSCRIPTION_INTERVAL_OPTIONS),
                work: {}
            };

            if (!req?.params?.id) {
                data.work = {
                    name: 'new_template',
                    category: data.categoryOptions[0],
                    service: data.servicesOptions[data.categoryOptions[0]][0][0],
                    workItems: [],
                    paymentItems: [],
                    subscription: {
                        payment: 0,
                        interval: c.SUBSCRIPTION_INTERVAL_OPTIONS.NA
                    },
                    initialPayment: 0,
                    initialPaymentStatus: c.PAYMENT_STATUS_OPTIONS.UNSET,
                    cancellationPayment: 0,
                    classType: data.categoryOptions[0] === 'Classes' ? c.CLASS_TYPE.NA : undefined,
                    cancellationPaymentStatus: c.PAYMENT_STATUS_OPTIONS.UNSET,
                    status: c.WORK_STATUS_OPTIONS.NA
                };
            } else {
                data.work = await WorkTemplate.findById(req.params.id).lean();
            }

            res.send(new Result({ data, success: true }));
        } catch (err) {
            res.send(new Result({ message: err.message, success: false }));
        }
    }

    public async deleteWorkTemplate(req: any, res: any) {
        try {
            const id = req.params.id; // Correctly access the id from path parameters
            await WorkTemplate.deleteOne({ _id: id }); // Use it in an object for the criteria

            res.send(new Result({
                success: true
            }));
        } catch (err) {
            res.send(new Result({ message: err.message, success: false }));
        }
    }
}

export default new WorkTemplateController();
