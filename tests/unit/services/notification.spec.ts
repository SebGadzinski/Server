import { expect } from 'chai';
import UnitTest from '../../bases/UnitTest';
import Notification from '../../../src/classes/Notification';
import NotificationService from '../../../src/services/NotificationService';
import { User } from '../../../src/models';

/**
 * This is meant for using with the front end running on another process so that you can validate that the notification was sent
 */
class NotificationServiceTest extends UnitTest {
  private notificationService = NotificationService.getInstance();

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
          test: 'Test Data'
        });

        let user = await User.findOne({
          email: 'user1@gmail.com'
        });
        expect(user).to.not.be.null;

        if (user) {
          let token = await this.notificationService.sendNotification(
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
