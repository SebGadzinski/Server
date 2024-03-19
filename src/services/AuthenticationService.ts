/**
 * @file Defines all authentication related business logic.
 * @author Sebastian Gadzinski
 */

import { LocalDateTime } from '@js-joda/core';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import RefreshTokenResponse from '../classes/RefreshTokenResponse';
import SignUpRequest from '../classes/Request/SignUpRequest';
import UserData from '../classes/UserData';
import config from '../config';
import { Token, User } from '../models';
import EmailService from './EmailService';
import UserService from './UserService';

class AuthenticationService {
  private readonly EMAIL_CONFIRMATION = 'emailConfirmation';
  private readonly RESET_PASSWORD = 'resetPassword';

  /**
   * Generates a JWT token, based on the provided login data.
   * @param email Email of the user that requests the token.
   * @param password Password of the user that requests the token.
   */
  public login(email: string, password: string): Promise<UserData> {
    return new Promise<UserData>((resolve, reject) => {
      if (!email) return reject('Email is required.');
      if (!password) return reject('Password is required.');

      User.findOne({ email })
        .lean()
        .then((user: any) => {
          if (!user) return reject('User not found.');

          bcrypt.hash(password, user.salt, (hashError, hash) => {
            if (hashError) return reject('Hash error.');
            if (hash !== user.password) return reject(`Passwords don't match.`);

            const accessToken = jwt.sign(
              {
                data: {
                  id: user._id,
                  email: user.email,
                  emailConfirmed: user.emailConfirmed,
                  expiresAt: new Date().getTime() + config.tokenExpirySeconds,
                  fullName: user.fullName,
                  roles: user.roles
                }
              },
              config.secret,
              { expiresIn: config.tokenExpirySeconds }
            );

            // Update refresh token if needed
            try {
              jwt.verify(user.refreshToken, config.refreshSecret);
            } catch (err) {
              const refreshExpSeconds =
                config.refreshTokenExpiryDays * 24 * 60 * 60;
              const newRefreshToken = jwt.sign(
                { data: { email: user.email, fullName: user.fullName } },
                config.refreshSecret,
                { expiresIn: refreshExpSeconds }
              );
              UserService.update({
                id: user._id,
                refreshToken: newRefreshToken
              });
              user.refreshToken = newRefreshToken;
            }

            delete user.password;
            delete user.salt;
            const userData = new UserData(user, 'Bearer ' + accessToken);

            console.log(`Login successful: ${user.email}`);

            resolve(userData);
          });
        })
        .catch((error: string) => reject(error));
    });
  }

  public async signUp(userInfo: SignUpRequest): Promise<UserData> {
    const emailValid = await EmailService.validateEmail(userInfo.email);
    if (emailValid) {
      const user: any = await UserService.create(userInfo);
      console.log(`Signed user up: ${user.email}`);
      return user;
    } else {
      throw new Error('Invalid email'); // This will reject the promise returned by signUpUser
    }
  }

  /**
   * Refreshes the token by provided refresh token.
   * @param refreshToken Refresh token for the user that needs to refresh the token.
   */
  public refreshToken(refreshToken: string): Promise<RefreshTokenResponse> {
    return new Promise<RefreshTokenResponse>((resolve, reject) => {
      if (!refreshToken) return reject('Refresh token is required.');

      jwt.verify(refreshToken, config.refreshSecret, (err, decoded: any) => {
        if (err) return reject(`Token error: ${err.message}`);

        User.findOne({ refreshToken })
          .lean()
          .then((user: any) => {
            if (!user) return reject('User not found.');

            // Check if the refresh token needs rotation (3 days logic)
            const refreshExpSeconds =
              config.refreshTokenExpiryDays * 24 * 60 * 60;
            const shouldRotate =
              new Date().getTime() - decoded.iat * 1000 >
              refreshExpSeconds * 1000;

            let newRefreshToken = refreshToken;
            if (shouldRotate) {
              newRefreshToken = jwt.sign(
                { data: { email: user.email, fullName: user.fullName } },
                config.secret,
                { expiresIn: refreshExpSeconds }
              );

              // Update user with new refresh token
              UserService.update({
                id: user._id,
                refreshToken: newRefreshToken
              });
              user.refreshToken = newRefreshToken;
            }

            // Create new access token
            const accessToken = jwt.sign(
              {
                data: {
                  id: user._id,
                  email: user.email,
                  fullName: user.fullName,
                  roles: user.roles,
                  emailConfirmed: user.emailConfirmed
                }
              },
              config.secret,
              { expiresIn: config.tokenExpirySeconds }
            );

            delete user.password;
            delete user.salt;
            resolve(
              new RefreshTokenResponse(
                'Bearer ' + accessToken,
                newRefreshToken,
                user
              )
            );
          })
          .catch((error: string) => reject(error));
      });
    });
  }

  /**
   * Creates token and send email with token with user so they can confirm there email
   * @param email Email of the user that requests the token.
   * @param password Password of the user that requests the token.
   */
  public async sendEmailConfirmation(id: string): Promise<void> {
    try {
      const user = await User.findOne({ _id: id });
      if (!user) throw new Error('No User Found');

      const amountOfTokens = await Token.count({
        reason: this.EMAIL_CONFIRMATION,
        expiration: { $gt: LocalDateTime.now() }
      });

      // Check if there are more than 5 such tokens
      if (amountOfTokens >= 5) {
        throw new Error('Please try again tomorrow');
      }

      // Create new token
      const token = await Token.create({
        referenceId: user._id,
        reason: this.EMAIL_CONFIRMATION,
        value: uuidv4(),
        expiration: LocalDateTime.now().plusDays(1)
      });
      if (user.emailConfirmed) {
        throw new Error('Already confirmed');
      } else {
        await EmailService.sendConfirmationEmail(user.email, token.value);
        console.log(`Sent email confirmation: ${user.email}`);
      }
    } catch (err) {
      console.error(err);
      throw err;
    }
  }

  /**
   * Creates token and sends email with token so user can rest pw
   * @param email Email of the user that requests the token.
   * @param password Password of the user that requests the token.
   */
  public async sendEmailResetPassword(id: string): Promise<void> {
    try {
      const query = id?.includes('@') ? { email: id } : { _id: id };
      const user = await User.findOne(query);
      if (!user) throw new Error('No User Found');

      const amountOfTokens = await Token.count({
        reason: this.RESET_PASSWORD,
        expiration: { $gt: LocalDateTime.now() }
      });

      // Check if there are more than 5 such tokens
      if (amountOfTokens >= 5) {
        throw new Error('Please try again tomorrow');
      }

      const token = await Token.create({
        referenceId: user._id,
        reason: this.RESET_PASSWORD,
        value: uuidv4(),
        expiration: LocalDateTime.now().plusDays(1)
      });
      await EmailService.sendResetPasswordEmail(user.email, token.value);
      console.log(`Sent reset password email: ${user.email}`);
    } catch (err) {
      console.error(err);
      throw err;
    }
  }

  /**
   * Confirms user email if the token is valid and not expired
   * @param token
   * @returns
   */
  public async confirmEmail(token: string): Promise<void> {
    try {
      const tokenFromDB = await Token.findOne({ value: token });
      if (!tokenFromDB) throw Error('Token not found');
      if (tokenFromDB.expiration < new Date()) {
        await tokenFromDB.deleteOne();
        throw Error('Token Expired');
      }

      // Token is valid, set email confirmed for user
      const user = await User.findOne({ _id: tokenFromDB.referenceId });
      if (!user) throw new Error('No User Found');
      await UserService.update({ id: user._id, emailConfirmed: true });
      await tokenFromDB.deleteOne();
      console.log(`confirmed email: ${user.email}`);
    } catch (err) {
      console.error(err);
      throw err;
    }
  }

  // Reset password for user if the token is valid and not expired
  public async resetPassword(token: string, password: string): Promise<void> {
    try {
      const tokenFromDB = await Token.findOne({ value: token });
      if (!tokenFromDB) throw new Error('No Token Found');
      if (tokenFromDB.expiration < new Date()) {
        await tokenFromDB.deleteOne();
        throw Error('Token Expired');
      }

      // Token is valid, update password
      const user = await User.findOne({ _id: tokenFromDB.referenceId });
      UserService.validatePassword(password);
      user.password = password;

      await UserService.update(user);
      await tokenFromDB.deleteOne();
      console.log(`Reset users password: ${user.email}`);
    } catch (err) {
      console.error(err);
      throw err;
    }
  }

  public async emailConfirmStatus(email: string): Promise<boolean> {
    try {
      const user = await User.findOne({ email });
      if (!user) throw new Error('No User Found');
      return user.emailConfirmed;
    } catch (err) {
      return false;
    }
  }

  public async logout(id: string): Promise<void> {
    try {
      const user = await User.findOne({ _id: id });
      if (!user) throw new Error('No User Found');
      user.refreshToken = 'reset';
      await UserService.update(user);
      console.log(`logged out user: ${user.email}`);
    } catch (err) {
      console.error(err);
      throw new Error('Sending Confirmation Email Failed');
    }
  }
}

export default new AuthenticationService();
