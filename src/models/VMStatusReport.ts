/**
 * @author Sebastian Gadzinski
 */
import mongoose, { Document, Model, Schema } from 'mongoose';

export interface IVMStatus {
    name: string;
    severity: string;
    info: string;
    date: Date;
}

export interface IPM2Process {
    name: string;
    date: Date;
    status: IVMStatus[];
}

export interface IVMStatusReport extends Document {
    database: {
        status: IVMStatus[]
    };
    pm2: {
        status: [{
            name: string,
            severity: string,
            info: string,
            date: Date
        }];
        processes: IPM2Process[]
    };
    system: {
        status: IVMStatus[]
    };
    status: IVMStatus[];
    lastAlertEmailSent?: Date;
}

const statusSchema = new Schema({
    name: String,
    severity: String,
    info: String,
    date: Date
}, { _id: false });

const processSchema = new Schema({
    name: String,
    date: Date,
    status: [statusSchema]
}, { _id: false });

interface IVMStatusReportModel extends Model<IVMStatusReport> { }

const VMStatusReportSchema: Schema = new mongoose.Schema({
    database: {
        type: {
            status: {
                type: [statusSchema],
                required: true
            },
        },
        required: true
    },
    pm2: {
        type: {
            status: {
                type: [statusSchema],
                required: true
            },
            processes: [processSchema],
        },
        required: true
    },
    system: {
        type: {
            status: {
                type: [statusSchema],
                required: true
            },
        },
        required: true
    },
    status: {
        type: [statusSchema],
        required: true
    },
    lastAlertEmailSent: { type: Date }
}, {
    timestamps: true // Automatically adds createdAt and updatedAt timestamps
});

const VMStatusReport: IVMStatusReportModel = mongoose.model<IVMStatusReport, IVMStatusReportModel>(
    'VMStatusReport',
    VMStatusReportSchema
);

export default VMStatusReport;
