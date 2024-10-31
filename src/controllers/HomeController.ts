/**
 * @file Controller for Home Page Data needs
 * @author Sebastian Gadzinski
 */
import _ from 'lodash';
import Result from '../classes/Result';
import {
  Category
} from '../models';

class HomeController {

  public async getSearchPageData(req: any, res: any) {
    try {
      const data = await Category.find().select(
        'name slug services.name services.slug services.thumbnailImg services.featured'
      );

      const workCards = [];
      const classCards = [];

      for (const category of data) {
        for (const service of category.services) {
          if (category.slug === 'classes') {
            classCards.push({
              category: category.name,
              categorySlug: category.slug,
              service: service.name,
              serviceSlug: service.slug,
              thumbnailImg: service.thumbnailImg,
              featured: service.featured
            });
          } else {
            workCards.push({
              category: category.name,
              categorySlug: category.slug,
              service: service.name,
              serviceSlug: service.slug,
              thumbnailImg: service.thumbnailImg,
              featured: service.featured
            });
          }
        }
      }

      res.send(new Result({ data: { workCards, classCards }, success: true }));
    } catch (err) {
      res.send(new Result({ message: err.message, success: false }));
    }
  }

}

export default new HomeController();
