/**
 * @file Defines all user related business logic.
 * @author Sebastian Gadzinski
 */

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Document } from 'mongoose';
import config from '../config';
import { User } from '../models';
import { IUser } from '../models/User';

class UserService {
  /**
   * Inserts a user into database.
   * @param user User that needs to be inserted.
   */
  public create(user: any): Promise<IUser> {
    return new Promise<IUser>((resolve, reject) => {
      if (!user.email) return reject('E-mail is mandatory.');
      if (!user.fullName) return reject('Full name is mandatory.');
      if (!user.password) return reject('Password is mandatory.');
      this.validatePassword(user.password);
      // Has to be logged in as admin to do this
      if (!user.roles || user.roles.length === 0) {
        return reject('Role is mandatory.');
      }

      User.findOne({ email: user.email })
        .lean()
        .then((data: any) => {
          if (!data) {
            // Values that should be set to defaults
            user.emailConfirmed = false;

            bcrypt.genSalt(config.saltRounds, (saltError, salt) => {
              if (saltError) return reject('Salt error.');

              bcrypt.hash(user.password, salt, (hashError, hash) => {
                if (hashError) return reject('Hash error.');

                const refreshToken = jwt.sign(
                  { data: { email: user.email, fullName: user.fullName } },
                  config.secret
                );

                user.refreshToken = refreshToken;
                user.password = hash;
                user.salt = salt;

                // Neccessary Fields
                user.createdBy = 'server';
                user.updatedBy = 'server';
                user.mfa = false;

                User.create(user)
                  .then(async (userDoc: IUser) => {
                    resolve(userDoc);
                  })
                  .catch((error) => reject(`User creation failed. ${error}`));
              });
            });
          } else reject('User Already Exists');
        })
        .catch((err) => {
          console.log(err);
          reject('User Creation Failed');
        });
    });
  }

  /**
   * Updates all the data for the provided user.
   * @param user User object with new data applied.
   */
  public update(user: any | IUser): Promise<any | IUser> {
    return new Promise<any | IUser>((resolve, reject) => {
      if (user.password) {
        bcrypt.genSalt(config.saltRounds, (saltError, salt) => {
          if (saltError) return reject('Salt error.');

          bcrypt.hash(user.password, salt, (hashError, hash) => {
            if (hashError) return reject('Hash error.');

            user.password = hash;
            user.salt = salt;

            User.updateOne({ _id: user.id }, { $set: user }, { multi: true })
              .then((data) => resolve(user))
              .catch((error) => reject('User update failed.'));
          });
        });
      } else {
        User.updateOne({ _id: user.id }, { $set: user }, { multi: true })
          .then((data) => resolve(user))
          .catch((error) => reject('User update failed.'));
      }
    });
  }

  /**
   * Removes a specific user from the db collection.
   * @param id Id of the user that needs to be removed.
   */
  public async delete(id: string): Promise<void> {
    try {
      await User.findByIdAndRemove(id);
      // TODO: Remove any other records from other collections
      // TODO: Do any actions (send emails)
    } catch (err) {
      console.error(err);
      throw new Error('Could not delete user');
    }
  }

  /**
   * Validates the provided password according to security best practices.
   * @param password The password to validate.
   * @throws An error with a specific message if validation fails.
   */
  public validatePassword(password: string): void {
    // Check the length
    if (password.length < 8) {
      throw new Error(
        'Password is too short. It should be at least 8 characters long.'
      );
    }

    // Check for at least one uppercase letter
    if (!/[A-Z]/.test(password)) {
      throw new Error('Password should contain at least one uppercase letter.');
    }

    // Check for at least one lowercase letter
    if (!/[a-z]/.test(password)) {
      throw new Error('Password should contain at least one lowercase letter.');
    }

    // Check for at least one number
    if (!/[0-9]/.test(password)) {
      throw new Error('Password should contain at least one number.');
    }

    // Check for at least one special character
    const specialCharacters = /[!@#$%^&*()_+\-=\[\]{};':"\\|~`,.<>\/?]+/;
    if (!specialCharacters.test(password)) {
      throw new Error(
        'Password should contain at least one special character (e.g., !, @, #, $, etc.).'
      );
    }
  }
}

export default new UserService();
