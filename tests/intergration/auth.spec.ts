/**
 * @file Tests attached to Processes/Server
 * @author Sebastian Gadzinski
 */

import { expect } from 'chai';
import IntergrationTest from '../bases/IntergrationTest';
import { Token, User } from '../../src/models';

const { simpleSignIn } = require('../data/users').default;

class AuthTest extends IntergrationTest {
  constructor() {
    super('Authorization Controller Tests', '/api/auth');
    this.run();
  }

  run() {
    describe(this.testName, () => {
      before(this.startMongo);

      let testUser = simpleSignIn;
      const newPassword = 'newPassword2!';

      it('sign up with valid credentials', async () => {
        const response = await this.ax.post('/signUp', {
          email: testUser.email,
          password: testUser.password,
          fullName: testUser.fullName
        });
        expect(response.data.success).to.be.true;

        //check to see if user has correct data inside
        expect(response.data.data).to.have.property('email', testUser.email);
      });

      it('login with valid credentials', async () => {
        const response = await this.ax.post('/', {
          email: testUser.email,
          password: testUser.password
        });
        expect(response.data.success).to.be.true;
        expect(response.data.data.user).to.have.property(
          'email',
          testUser.email
        );

        // Capture the Authorization token
        const authToken = response.data.data.token;
        expect(authToken).to.not.be.null;
        this.ax.defaults.headers.common['Authorization'] = authToken;

        testUser = response.data.data.user;
      });

      it('Validates user email is confirmed', async () => {
        //get most recent token for user
        let token = await Token.findOne({});
        const response = await this.ax.post(`/${token?.value}/confirmEmail`);
        expect(response.data.success).to.be.true;
        //Check to see if user has emailConfirmed true
        let user = await User.findOne({});
        expect(user?.emailConfirmed).to.be.true;
      });

      it('refresh token', async () => {
        //check to see if token refreshes
        const response = await this.ax.post(`/refresh`, {
          token: testUser.refreshToken
        });
        expect(response.data.success).to.be.true;
        expect(response.data.data.refreshToken).to.be.not.eq(
          testUser.refreshToken
        );
        testUser.refreshToken = response.data.data.refreshToken;
        expect(response.data.data.token).to.be.a('string');
        expect(response.data.data.refreshToken).to.be.a('string');

        this.ax.defaults.headers.common['Authorization'] =
          response.data.data.token;
      });

      //Attempt resetting password
      it('Reset users password', async () => {
        //Send reset password email
        const resetPasswordEmailRes = await this.ax.post(
          `/${testUser._id}/sendEmailResetPassword`
        );
        expect(resetPasswordEmailRes.data.success).to.be.true;
        //get most recent token for user
        let token = await Token.findOne({});
        const resetPasswordRes = await this.ax.post(
          `/${token?.value}/resetPassword`,
          { password: newPassword }
        );
        expect(resetPasswordRes.data.success).to.be.true;
      });

      it('login with new password', async () => {
        const response = await this.ax.post('/', {
          email: testUser.email,
          password: newPassword
        });
        expect(response.data.success).to.be.true;
        expect(response.data.data.user).to.have.property(
          'email',
          testUser.email
        );

        // Capture the Authorization token
        const authToken = response.data.data.token;
        expect(authToken).to.not.be.null;
        this.ax.defaults.headers.common['Authorization'] = authToken;

        testUser = response.data.data.user;
      });

      it('logout', async () => {
        const response = await this.ax.post(`/${testUser._id}/logout`);
        expect(response.data.success).to.be.true;
      });

      after(this.killMongo);
    });
  }
}

export default new AuthTest();
