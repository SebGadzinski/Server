/**
 * @author Sebastian Gadzinski
 */
import mongoose, { Document, Model, Schema } from 'mongoose';

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
}

interface IWorkerModel extends Model<IWorker> { }

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
    }
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
        socials: { type: socialSchema, required: false }
    },
    {
        timestamps: true
    }
);

const Worker: IWorkerModel = mongoose.model<IWorker, IWorkerModel>(
    'Worker',
    WorkerSchema
);

export default Worker;
