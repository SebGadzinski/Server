/**
 * @file Controller for Browse Pages
 * @author Sebastian Gadzinski
 */

import Result from '../classes/Result';
import {
    Category, User, Worker, WorkTemplate
} from '../models';

class BrowseController {
    public async getBrowsePageData(req: any, res: any) {
        try {
            const data = await Category.find().select(
                'name slug thumbnailImg services.name services.description services.slug'
            );

            res.send(new Result({ data, success: true }));
        } catch (err) {
            res.send(new Result({ message: err.message, success: false }));
        }
    }

    public async getCategoryPageData(req: any, res: any) {
        try {
            const data = await Category.aggregate([
                { $match: { slug: req.params?.categorySlug } },
                {
                    $project: {
                        services: 1,
                        watchMeImg: 1, // Keep watchMeImg for later stages
                        watchMeLink: 1, // Keep watchMeImg for later stages
                        _id: 0
                    }
                },
                { $unwind: '$services' },
                {
                    $project: {
                        name: '$services.name',
                        description: '$services.description',
                        thumbnailImg: '$services.thumbnailImg',
                        slug: '$services.slug',
                        watchMeImg: 1, // Carry watchMeImg through projection
                        watchMeLink: 1, // Keep watchMeImg for later stages
                    }
                },
                {
                    $group: {
                        _id: null, // Group all documents together since we're only dealing with one category
                        services: {
                            $push: {
                                name: '$name',
                                description: '$description',
                                thumbnailImg: '$thumbnailImg',
                                slug: '$slug',
                            }
                        },
                        watchMeImg: { $first: '$watchMeImg' },
                        watchMeLink: { $first: '$watchMeLink' },
                    }
                },
                {
                    $project: {
                        _id: 0,
                        watchMeLink: 1,
                        watchMeImg: 1,
                        services: 1
                    }
                }
            ]);

            if (!data || data.length === 0) {
                throw new Error(`No data for category ${req.body.categorySlug}`);
            }

            res.send(new Result({ data, success: true }));
        } catch (err) {
            res.send(new Result({ message: err.message, success: false }));
        }
    }

    // _Category.Service
    public async getServicePageData(req: any, res: any) {
        try {
            const categorySlug = req.params?.categorySlug;
            const serviceSlug = req.params?.serviceSlug; // assuming the service slug is provided in the request

            // Find the category and project only the matching service
            const category = await Category.findOne(
                { slug: categorySlug, services: { $elemMatch: { slug: serviceSlug } } },
                { 'name': 1, 'services.$': 1 }
            ).lean();

            if (!category || !category.services) {
                return res.send(
                    new Result({ message: 'Service not found', success: false })
                );
            }

            // Extract the matched service
            const service: any = category.services[0];
            // Get templates
            const workTemplates = await WorkTemplate.find(
                { category: category.name, service: service.name },
                { name: 1, _id: 1 }).lean();
            const workTemplatesToAttach = workTemplates.reduce((acc, template) => {
                // for each of the templates possible, add there info into
                acc[template._id.toString()] = {
                    name: template.name, _id: template._id
                };
                return acc;
            }, {});
            // Find workers
            service.workers = [];
            const workers: any = await Worker.find({ categorySlug, serviceSlug }).lean();
            for (const worker of workers) {
                worker.name = (await User.findById(worker.userId)).fullName;
                if (category.name !== 'Classes') {
                    // Add templates assigned to this worker
                    const templates = [];
                    for (const id of worker.templates) {
                        if (workTemplatesToAttach[id.toString()]) {
                            templates.push(workTemplatesToAttach[id.toString()]);
                        }
                    }
                    worker.templates = templates;
                }

                service.workers.push(worker);
            }

            service.templates = workTemplates;

            res.send(new Result({ data: service, success: true }));
        } catch (err) {
            res.send(new Result({ message: err.message, success: false }));
        }
    }
}

export default new BrowseController();
