/**
 * @author Sebastian Gadzinski
 */
import mongoose, { Document, Model, Schema } from 'mongoose';
import { transform } from '../utils/transform';

export interface IBookMeetingInterval extends Document {
  start: Date;
  end: Date;
}

export interface ICategory extends Document {
  _id: Schema.Types.ObjectId;
  name: string;
  slug: string;
  services: [
    {
      name: string;
      slug: string;
      description: string;
      thumbnailImg: string;
      slides: [{ text: string; image: string }];
      details: [{ header: string; info: string }];
      faqs: [{ question: string; answer: string }];
      bookMeetingIntervals: IBookMeetingInterval[];
      meetingTimes?: [Date];
    }
  ];
  thumbnailImg: string;
  watchMeImg: string;
  watchMeLink: string;
  createdBy: string;
  updatedBy: string;
}

interface ISlug {
  categorySlug?: string;
  serviceSlug?: string;
}
interface INames {
  category?: string;
  service?: string;
}

interface ICategoryModel extends Model<ICategory> {
  getSlugs(category: string, service?: string): Promise<ISlug>;
  getNames(categorySlug: string, serviceSlug?: string): Promise<INames>;
  getCategoryServiceOptions(names?: boolean): Promise<any>;
}

const bookMeetingIntervalsSchema = new Schema({
  start: Date,
  end: Date
}, { _id: false });

const CategorySchema: Schema = new mongoose.Schema(
  {
    // Reference ID can be a user id, can be a id for a group or tag or anything.
    // purpose is to make this Category collection usable for any type of need
    name: { type: String, required: true },
    slug: { type: String, required: true },
    services: {
      type: [
        {
          name: String,
          slug: String,
          description: String,
          thumbnailImg: String,
          slides: [{ text: String, image: String }],
          details: [{ header: String, info: String }],
          faqs: [{ question: String, answer: String }],
          bookMeetingIntervals: { type: [bookMeetingIntervalsSchema], required: true },
          meetingTimes: { type: [Date], required: false },
        }
      ],
      required: true
    },
    thumbnailImg: { type: String, required: true },
    watchMeImg: { type: String, required: true },
    watchMeLink: { type: String, required: true }
  },
  {
    timestamps: true,
    toJSON: { transform },
    statics: {
      async getSlugs(category: string, service?: string): Promise<ISlug> {
        const result: ISlug = {};

        const categoryProjection = {
          slug: 1,
          services: service ? { $elemMatch: { name: service } } : 1
        };

        const myCategory = await Category.findOne({ name: category }, categoryProjection).lean();

        if (myCategory) {
          // Assign the category slug
          result.categorySlug = myCategory.slug;

          // If a specific service is requested, assign the service slug
          if (service && myCategory.services.length > 0) {
            result.serviceSlug = myCategory.services[0].slug;
          }
        }

        return result;
      },
      async getNames(categorySlug: string, serviceSlug?: string): Promise<INames> {
        const result: INames = {};

        const categoryProjection = {
          name: 1,
          services: serviceSlug ? { $elemMatch: { slug: serviceSlug } } : 1
        };

        const myCategory = await Category.findOne({ slug: categorySlug }, categoryProjection).lean();

        if (myCategory) {
          // Assign the category slug
          result.category = myCategory.name;

          // If a specific service is requested, assign the service slug
          if (serviceSlug && myCategory.services.length > 0) {
            result.service = myCategory.services[0].name;
          }
        }

        return result;
      },
      async getCategoryServiceOptions(names: boolean): Promise<any> {
        const dicType = names ? 'name' : 'slug';

        const $project: any = { _id: 0, services: 1 };

        if (names) {
          $project.name = '$_id';
        } else {
          $project.slug = '$_id';
        }

        const aggre = [
          { $group: { _id: `$${dicType}`, services: { $push: `$services.${dicType}` } } },
          { $project }
        ];

        return await Category.aggregate(aggre).then((results) => {
          // Create a dictionary from the results
          const servicesDict = {};
          results.forEach((item) => {
            servicesDict[item[dicType]] = item.services;
          });
          return servicesDict;
        });
      }
    }
  }
);

const Category: ICategoryModel = mongoose.model<ICategory, ICategoryModel>(
  'category',
  CategorySchema
);

export default Category;
