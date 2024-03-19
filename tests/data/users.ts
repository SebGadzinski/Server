/**
 * @file User Test Data
 * @author Sebastian Gadzinski
 */

import SignUpRequest from '../../src/classes/Request/SignUpRequest';

const simpleSignIn = new SignUpRequest({
  email: 'user@gmail.com',
  fullName: 'User Lastname',
  password: 'Userpassword2!',
  roles: ['user'],
  refreshToken: 'someRefreshToken' // You might need to adjust this
});

export default { simpleSignIn };
