/**
 * @file Defines a schema for the user collection.
 * @author Sebastian Gadzinski
 */
import mongoose, { Document, Model, Schema } from 'mongoose';
import { transform } from '../utils/transform';

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
    }
  ];
  thumbnailImg: string;
  createdBy: string;
  updatedBy: string;
}

interface ICategoryModel extends Model<ICategory> {}

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
          faqs: [{ question: String, answer: String }]
        }
      ],
      required: true
    },
    thumbnailImg: { type: String, required: true }
  },
  {
    timestamps: true,
    toJSON: { transform },
    statics: {}
  }
);

const Category: ICategoryModel = mongoose.model<ICategory, ICategoryModel>(
  'category',
  CategorySchema
);

export default Category;
