/**
 * @file Client's endpoint functions to sync with server data
 * @author Sebastian Gadzinski
 */

import { compareVersions } from 'compare-versions';
import fs from 'fs';
import isSemver from 'is-semver';

import Result from '../classes/Result';
import config from '../config';
import { Token } from '../models';
import NotificationService from './NotificationService';

class AppService {
  /**
   * Checks to see if a update is available
   * @param currentVersion
   * @returns update information if update is available
   */
  public checkForUpdate(currentVersion: string): Promise<Result> {
    return new Promise<Result>((resolve, reject) => {
      if (!currentVersion || !isSemver(currentVersion)) {
        reject('Need to provide a semver currentVersion');
      }

      let updateFiles = [];
      let latestVersion = '';
      const fileName = 'dist.zip';

      fs.readdir(config.appVersionDirectory, (err, files) => {
        if (err) {
          reject('Error in checking for updates');
        }

        files.forEach((file) => {
          if (isSemver(file)) {
            updateFiles.push(file);
          }
        });

        updateFiles = updateFiles.sort(compareVersions);
        latestVersion = updateFiles[updateFiles.length - 1];
        const result = compareVersions(latestVersion, currentVersion);
        if (result !== 1) return new Result({ status: 304, success: false });
        const filePath = `${config.appVersionDirectory}/${latestVersion}/${fileName}`;
        const downloadUrl = `${config.downloadAppEndpoint}/${latestVersion}/dist.zip`;
        if (!fs.existsSync(filePath)) {
          throw reject('Missing files');
        }

        resolve(
          new Result({
            status: 200,
            success: true,
            message: 'Update Available',
            data: {
              newVersion: latestVersion,
              url: downloadUrl
            }
          })
        );
      });
    });
  }

  public checkIfFileExists(filePath: string): boolean {
    return fs.existsSync(filePath);
  }

  /**
   *
   * @param currentVersion
   * @returns
   */
  public getLatestVersion(): Promise<Result> {
    return new Promise<Result>((resolve, reject) => {
      let updateFiles = [];
      let latestVersion = '';
      const fileName = 'dist.zip';

      fs.readdir(config.appVersionDirectory, (err, files) => {
        if (err) {
          reject('Error in checking for updates');
        }

        files.forEach((file) => {
          if (isSemver(file)) {
            updateFiles.push(file);
          }
        });

        updateFiles = updateFiles.sort(compareVersions);
        latestVersion = updateFiles[updateFiles.length - 1];
        const filePath = `${config.appVersionDirectory}${latestVersion}/${fileName}`;
        const downloadUrl = `${config.downloadAppEndpoint}/${latestVersion}/dist.zip`;

        if (!fs.existsSync(filePath)) {
          reject('Missing files');
        }

        resolve(
          new Result({
            status: 200,
            success: true,
            data: {
              version: latestVersion,
              url: downloadUrl
            }
          })
        );
      });
    });
  }

  /**
   * Returns an array containing all users inside the db collection.
   */
  public async updateNotificationSubscription(
    referenceId: string,
    token: string,
    enable: boolean
  ): Promise<void> {
    try {
      if (enable) {
        await NotificationService.upsertNotificationToken(referenceId, token);
      } else {
        // make sure it deletes it
        await Token.deleteMany({
          reason: 'notification',
          referenceId,
          value: token
        });
      }
    } catch (err) {
      throw err;
    }
  }
}
export default new AppService();
