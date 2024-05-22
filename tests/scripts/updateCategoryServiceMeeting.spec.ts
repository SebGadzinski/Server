/**
 * @file Notification Unit Tests For Services
 * @author Sebastian Gadzinski
 */

import UnitTest from '../bases/UnitTest';
import { Category } from '../../src/models';

class UpdateCategoryServiceMeetingScript extends UnitTest {
  constructor() {
    super('Update Category Service Meeting Times');
    this.run();
  }

  run() {
    describe(this.testName, () => {
      before(async () => {
        await this.startMongo(false);
      });

      it('Update Meeting Times', async () => {
        const meetingTimes = [new Date("2024-05-22T02:00")];

        const cat = (await Category.findOne(
          { 'slug': "classes", 'services.slug': "get-schooled-son" },
          { 'services.slug': 1, 'services.meetingTimes': 1 })
        );

        const service = cat?.services.find(x => x.slug === 'get-schooled-son');

        if (service) {
          service.meetingTimes = meetingTimes;
          await cat?.save();
        }
      });
    });
  }
}

new UpdateCategoryServiceMeetingScript();
