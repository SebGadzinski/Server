/**
 * @author Sebastian Gadzinski
 */

import { DateTime } from 'luxon';
import { Meetings, Token } from '../models';
import CronProcess from './_CronProcess';

class DatabaseCleaner extends CronProcess {
  private readonly DELETE_TOKENS_DAYS = 1;
  private readonly DELETE_MEETING_DAYS = 1;

  constructor() {
    super('DatabaseCleaner', {
      func: async () => {
        await this.cleanTokensCode();
        await this.removeOldMeetings();
      },
      interval: '0 0 */1 * * *',
    }, {
      connectToDb: true,
      startMessage: 'Database Cleaner started'
    });
  }

  public async removeOldMeetings() {
    const cutoffDate = DateTime.now().minus({ days: this.DELETE_MEETING_DAYS });

    await Meetings.deleteMany({
      startDate: {
        $lt: cutoffDate.toJSDate()
      }
    });
    console.log(
      `${new Date().toISOString()} || Cleared meetings older than ${this.DELETE_MEETING_DAYS} days old...`
    );
  }

  private async cleanTokensCode() {
    const cutoffDate = DateTime.now().minus({ days: this.DELETE_TOKENS_DAYS });
    await Token.deleteMany({
      expiration: {
        $lt: cutoffDate
      }
    });
    console.log(
      `${new Date().toISOString()} || Cleared tokens older than ${this.DELETE_TOKENS_DAYS} days old...`
    );
  }

}

const dbCleaner = new DatabaseCleaner();
dbCleaner.run();
