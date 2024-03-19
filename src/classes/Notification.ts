/**
 * @file Class used for app and email notifications
 * @author Sebastian Gadzinski
 */

class Notification {
  public title: string;
  public body: string;
  public data: { [key: string]: any };

  constructor(title: string, body: string, data?: { [key: string]: any }) {
    this.title = title;
    this.body = body ?? '';
    this.data = data;
  }
}

export default Notification;
