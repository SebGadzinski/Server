/**
 * @file Notification related functionality.
 * @author Sebastian Gadzinski
 */

import * as admin from 'firebase-admin';
import {
  BatchResponse,
  Message,
  MulticastMessage
} from 'firebase-admin/lib/messaging/messaging-api';
import { Schema } from 'mongoose';
import Notification from '../classes/Notification';
import config from '../config';
import Token from '../models/Token'; // Adjust this import to your file structure

type ObjectId = Schema.Types.ObjectId;

class NotificationService {
  public static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  private static instance: NotificationService;

  private constructor() {
    // Initialize the Firebase Admin SDK with your service account credentials
    if (!admin.apps.length) {
      const serviceAcc: admin.ServiceAccount = {
        privateKey: config.firebaseServiceAccount.private_key,
        projectId: config.firebaseServiceAccount.project_id,
        clientEmail: config.firebaseServiceAccount.client_email
      };
      admin.initializeApp({
        credential: admin.credential.cert(serviceAcc)
      });
    }
  }

  /**
   * Sends a push notification using the referenceId to find the FCM token.
   * @param {string} referenceId The reference ID associated with the FCM token. (user id, can be a store id...)
   * @param {Message} message  The message .
   */
  public async sendNotification(
    referenceId: string | ObjectId,
    notification: Notification
  ): Promise<string> {
    try {
      const tokenDoc = await Token.findOne({
        referenceId,
        reason: 'notification'
      }).lean();

      if (!tokenDoc) {
        throw new Error(`Token not found for reference id ${referenceId}`);
      } else if (tokenDoc.expiration < new Date()) {
        await tokenDoc.deleteOne();
        throw new Error(`Token expired on ${tokenDoc.expiration}`);
      }

      const message: Message = {
        token: tokenDoc.value,
        notification: { title: notification.title, body: notification.body },
        android: {
          notification: {
            sound: 'default'
          }
        },
        apns: {
          payload: {
            aps: {
              sound: 'default'
            }
          }
        },
        data: { jsonData: JSON.stringify(notification.data) }
        // Any other properties can be added, but this hits IoS and Android devices
      };

      return await admin.messaging().send(message, false);
    } catch (error) {
      // console.log(`Failed to send notification: ${error.message}`);
    }
  }

  /**
   * Sends a push notification using the referenceId to find the FCM token.
   * @param {string[]} referenceId The reference ID associated with the FCM token. (user id, can be a store id...)
   * @param {Message} message  The message .
   */
  public async sendMultipleNotifications(
    referenceIds: string[] | ObjectId[],
    notification: Notification
  ): Promise<BatchResponse> {
    try {
      const result = await Token.find({
        referenceId: { $in: referenceIds },
        reason: 'notification'
      }).lean();

      const message: MulticastMessage = {
        tokens: result.map((x) => x.value),
        notification: { title: notification.title, body: notification.body },
        android: {
          notification: {
            sound: 'default'
          }
        },
        apns: {
          payload: {
            aps: {
              sound: 'default'
            }
          }
        },
        data: notification.data
        // Any other properties can be added, but this hits IoS and Android devices
      };

      const messageResult = await admin
        .messaging()
        .sendEachForMulticast(message, false);
      return messageResult;
    } catch (error) {
      throw new Error(`Failed to send notification: ${error.message}`);
    }
  }

  /**
   * Generates a new FCM token for the given referenceId.
   * @param {string} referenceId The reference ID for which the token is generated.
   * @param {string} token token to attach
   */
  public async upsertNotificationToken(
    referenceId: string,
    token: string
  ): Promise<string> {
    const expirationDate = new Date();
    expirationDate.setFullYear(expirationDate.getFullYear() + 1);

    try {
      await Token.updateOne(
        { referenceId, reason: 'notification' },
        {
          referenceId,
          reason: 'notification',
          value: token,
          expiration: expirationDate
        },
        { upsert: true }
      );

      console.log(`Notification Token Created: ${token}`);
    } catch (error) {
      throw new Error(`Failed to send notification: ${error.message}`);
    }

    return token;
  }
}

export default NotificationService.getInstance();
