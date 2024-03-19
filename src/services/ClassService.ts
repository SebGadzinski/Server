/**
 * @file Class related functionality.
 * @author Sebastian Gadzinski
 */

import config, { c } from '../config';
import { Category, Classes, Work, WorkTemplate } from '../models';

interface IEnrollmentStatus {
    work?: any;
    template?: any;
    status: { allowed: boolean; reason?: string; };
}
interface QEnrollmentStatus {
    userId: string;
    templateId?: string;
    workId?: string;
}

class ClassService {
    public static getInstance(): ClassService {
        if (!ClassService.instance) {
            ClassService.instance = new ClassService();
        }
        return ClassService.instance;
    }

    private static instance: ClassService;

    public async enrollmentStatus({ userId, templateId, workId }: QEnrollmentStatus)
        : Promise<IEnrollmentStatus> {
        try {
            const result: IEnrollmentStatus = {
                status: {
                    allowed: true
                }
            };
            let myWork: any = {};
            if (templateId) {
                myWork = await WorkTemplate.findById(templateId);

                if (!myWork) {
                    throw new Error('Cannot find template');
                }

                if (myWork.classType === c.CLASS_TYPE.TIME_FRAME) {
                    throw new Error('Need to book meeting');
                }

                const slug = await Category.getSlugs(myWork.category, myWork.service);

                myWork.categorySlug = slug.categorySlug;
                myWork.serviceSlug = slug.serviceSlug;
                result.template = myWork;
            } else if (workId) {
                myWork = await WorkTemplate.findById(templateId);

                if (!myWork) {
                    throw new Error('Cannot find template');
                }
                result.work = myWork;
            }

            // Check to see if already enrolled
            const sameClass = await Work.count(({
                userId,
                categorySlug: myWork.categorySlug,
                serviceSlug: myWork.serviceSlug,
                status: {
                    $in: [c.WORK_STATUS_OPTIONS.SUBSCRIBED,
                    c.WORK_STATUS_OPTIONS.IN_USE,
                    c.WORK_STATUS_OPTIONS.CONFIRMATION_REQUIRED,
                    c.WORK_STATUS_OPTIONS.NEEDS_ATTENTION,
                    c.WORK_STATUS_OPTIONS.USER_ACCEPTED,
                    ]
                }
            }));

            if (sameClass > 0) {
                throw new Error('Already in class.');
            }

            // Subscribers of work vs Classes.occupancyCap
            const subscribers = await Work.count(({ status: 'Subscribed' }));
            const myClass = await Classes.findOne(({ serviceSlug: myWork.serviceSlug }));

            if (subscribers >= myClass.occupancyCap) {
                throw new Error('Occupancy Full');
            }

            return result;
        } catch (error) {
            console.error('Error enrolling:', error);
            return { status: { allowed: false, reason: error.toString() } };
        }
    }
}

export default ClassService.getInstance();
