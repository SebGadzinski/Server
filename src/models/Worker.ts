/**
 * @author Sebastian Gadzinski
 */
import mongoose, { Document, Model, Schema } from 'mongoose';
import { transform } from '../utils/transform';

export interface Social {
    instagram?: string;
    youtube?: string;
    custom?: string;
}

export interface Summary {
    title: string;
    text: string;
    icon?: {
        name: string;
        color?: string;
    };
    badge?: {
        label: string;
        color?: string;
    };
}

export interface IWorker extends Document {
    _id: Schema.Types.ObjectId;
    userId: Schema.Types.ObjectId;
    categorySlug: string;
    serviceSlug: string;
    thumbnailImg: string;
    templates: Schema.Types.ObjectId[];
    summary: Summary[];
    socials?: Social;
    createdBy: string;
    updatedBy: string;
}

export interface IWorkerData {
    name: string;
    email: string;
}

interface IWorkerModel extends Model<IWorker> {
    getWorkers(categorySlug: string, serviceSlug: string): Promise<IWorkerData[]>;
}

const summarySchema = new Schema({
    title: String,
    text: String,
    icon: {
        type: {
            name: String,
            color: {
                type: String,
                required: false
            }
        },
        required: false
    },
    badge: {
        type: {
            label: String,
            color: {
                type: String,
                required: false
            }
        },
        required: false
    },
}, { _id: false });

const socialSchema = new Schema({
    instagram: { type: String, required: false },
    youtube: { type: String, required: false },
    custom: { type: String, required: false },
}, { _id: false });

const WorkerSchema: Schema = new mongoose.Schema(
    {
        userId: { type: Schema.Types.ObjectId, required: true },
        categorySlug: { type: String, required: true },
        serviceSlug: { type: String, required: true },
        thumbnailImg: { type: String, required: true },
        summary: { type: [summarySchema], required: true },
        templates: {
            type: [Schema.Types.ObjectId],
            required: true
        },
        socials: { type: socialSchema, required: false },
        createdBy: { type: String, required: true },
        updatedBy: { type: String, required: true }
    },
    {
        timestamps: true,
        toJSON: { transform },
        statics: {
            async getWorkers(categorySlug: string, serviceSlug: string): Promise<IWorkerData[]> {
                const data = await Worker.aggregate([
                    {
                        $match: {
                            categorySlug,
                            serviceSlug
                        }
                    },
                    {
                        $lookup: {
                            from: 'users',
                            localField: 'userId',
                            foreignField: '_id',
                            as: 'user'
                        }
                    },
                    {
                        $unwind: '$user'
                    },
                    {
                        $project: {
                            _id: 0,
                            email: '$user.email',
                            name: '$user.fullName'
                        }
                    }
                ]);

                return data;
            }
        }
    }
);

const Worker: IWorkerModel = mongoose.model<IWorker, IWorkerModel>(
    'Worker',
    WorkerSchema
);

export default Worker;
