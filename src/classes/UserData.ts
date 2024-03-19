/**
 * @file Data returned from Login
 * @author Sebastian Gadzinski
 */

import User from '../models/User';

class UserData {
  public user: typeof User;
  public token: string;

  constructor(data: typeof User, token: string) {
    this.user = data;
    this.token = token;
  }
}

export default UserData;
