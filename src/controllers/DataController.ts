/**
 * @file Controller for application needs
 * @author Sebastian Gadzinski
 */
import Result from '../classes/Result';
import config from '../config';
import { Category, Token, User } from '../models';

class DataController {
  private static readonly publicCollections = {
    category: Category
  };
  public async getCollection(req: any, res: any) {
    try {
      const collectionName = req.body.name;
      const page = req.body.page || 1;
      const limit = req.body.limit || 10; // Number of items per page
      if (DataController.publicCollections[collectionName]) {
        const offset = (page - 1) * limit;
        const data = await DataController.publicCollections[collectionName]
          .find()
          .skip(offset)
          .limit(limit);

        res.send(new Result({ data, success: true }));
      } else {
        res.send(new Result({ success: false }));
      }
    } catch (err) {
      res.send(new Result({ message: err.message, success: false }));
    }
  }

  public async getHomePageData(req: any, res: any) {
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
        { $match: { slug: req.body.categorySlug } },
        { $project: { services: 1, _id: 0 } },
        { $unwind: '$services' },
        {
          $project: {
            name: '$services.name',
            description: '$services.description',
            thumbnailImg: '$services.thumbnailImg',
            slug: '$services.slug'
          }
        }
      ]);

      res.send(new Result({ data, success: true }));
    } catch (err) {
      res.send(new Result({ message: err.message, success: false }));
    }
  }
}

export default new DataController();
