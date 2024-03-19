/**
 * @author Sebastian Gadzinski
 */
import mongoose, { Document, Model, Schema } from 'mongoose';

export interface IStats extends Document {
    _id: Schema.Types.ObjectId;
    name: string;
    value: any;
}

interface IStatsModel extends Model<IStats> { }

const StatsSchema: Schema = new mongoose.Schema(
    {
        name: { type: String, required: true, unique: true },
        value: { type: Object, required: true, default: 0 }
    },
    {
        timestamps: true
    }
);

const Config: IStatsModel = mongoose.model<IStats, IStatsModel>(
    'Stats',
    StatsSchema
);

export default Config;
