/**
 * @file Notification Unit Tests For Services
 * @author Sebastian Gadzinski
 */

import { expect } from 'chai';
import UnitTest from '../../bases/UnitTest';
import Notification from '../../../src/classes/Notification';
import NotificationService from '../../../src/services/NotificationService';
import { User } from '../../../src/models';

/**
 * This is meant for using with the front end running on another process so that you can validate that the notification was sent
 */
class NotificationServiceTest extends UnitTest {
  constructor() {
    super('Notification Service Tests');
    this.run();
  }

  run() {
    describe(this.testName, () => {
      before(async () => {
        await this.startMongo(false);
        // await this.createSimpleUsers(1);
      });

      // Run android application or IoS and verify that the notifcation sent
      it('Custom Send Notification', async () => {
        let testNotification = new Notification('Test', 'this is the body', {
          dotdotdot: {
            progress: false,
            color: 'accent',
            position: 'center'
          },
          to: {
            label: 'GO',
            color: 'primary',
            route: {
              path: '/work'
            }
          }
        });

        let user = await User.findOne({
          email: 'seb.gadzy@gmail.com'
        });
        expect(user).to.not.be.null;

        if (user) {
          let token = await NotificationService.sendNotification(
            user._id,
            testNotification
          );
          expect(token).to.be.a.string;
        }
      });
    });
  }
}

new NotificationServiceTest();
