/**
 * @author Sebastian Gadzinski
 */
import mongoose, { Document, Model, Schema, Types } from 'mongoose';
import { transform } from '../utils/transform';

export interface IWorkTemplate extends Document {
    name: string;
    category: string;
    service: string;
    workItems: [
        {
            name: string;
            description: string;
            links: [{ name: string; url: string }];
            status: string;
        }
    ];
    paymentItems: [
        {
            name: string;
            description: string;
            payment: number;
            status: string;
        }
    ];
    subscription?: {
        payment: number;
        interval: string;
    };
    initialPayment: number;
    initialPaymentStatus: string;
    cancellationPayment: number;
    cancellationPaymentStatus: string;
    classType?: string;
    status: string;
    createdBy: string;
    updatedBy: string;
}

interface IWorkTemplateModel extends Model<IWorkTemplate> {
}

const WorkTemplateSchema: Schema = new mongoose.Schema(
    {
        name: { type: String, required: true },
        category: { type: String, required: true },
        service: { type: String, required: true },
        workItems: [
            {
                name: { type: String, required: true },
                description: { type: String, required: true },
                links: [
                    {
                        name: { type: String, required: true },
                        url: { type: String, required: true }
                    }
                ],
                status: { type: String, required: true }
            }
        ],
        paymentItems: [
            {
                name: { type: String, required: true },
                description: { type: String, required: true },
                payment: { type: Number, required: true },
                status: { type: String, required: true }
            }
        ],
        subscription:
        {
            type: {
                payment: { type: Number, required: true },
                interval: { type: String, required: true },
            },
            required: false
        },
        initialPayment: { type: Number, required: true },
        initialPaymentStatus: { type: String, required: true },
        cancellationPayment: { type: Number, required: true },
        cancellationPaymentStatus: { type: String, required: true },
        status: { type: String, required: true },
        classType: { type: String },
        createdBy: { type: String, required: true },
        updatedBy: { type: String, required: true }
    },
    {
        timestamps: true,
        toJSON: { transform },
    }
);

const WorkTemplate: IWorkTemplateModel =
    mongoose.model<IWorkTemplate, IWorkTemplateModel>('worktemplates', WorkTemplateSchema);

export default WorkTemplate;
