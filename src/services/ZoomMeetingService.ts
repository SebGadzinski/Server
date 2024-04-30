/**
 * @file Zoom Meeting functionality.
 * @author Sebastian Gadzinski
 */

import axios from 'axios';
import config from '../config';

class ZoomMeetingService {
  public static getInstance(): ZoomMeetingService {
    if (!ZoomMeetingService.instance) {
      ZoomMeetingService.instance = new ZoomMeetingService();
    }
    return ZoomMeetingService.instance;
  }

  private static instance: ZoomMeetingService;
  private accessToken: string;

  constructor() {
    this.accessToken = '';
  }

  public async createMeeting({
    topic, startDate, duration, alternativeHosts, password
  }: {
    topic: string,
    startDate: Date,
    duration: number,
    alternativeHosts?: string[],
    password?: boolean
  }): Promise<{ join_url?: string; meetingId?: string, password?: string }> {
    if (!this.accessToken) {
      await this.authenticate();
    }

    try {
      let meetingPassword;

      // Generate password if password == true
      if (password) {
        meetingPassword = this.generatePassword();
      }

      const startTime = startDate.toISOString().replace('.000Z', 'Z');

      const payload: any = {
        topic,
        type: 2,
        start_time: startTime,
        duration,
        settings: {},
        ...(password && { password: meetingPassword })
      };

      if (alternativeHosts) {
        payload.settings.alternative_hosts = alternativeHosts.join(',');
      }

      // Generate password if password == true
      const response = await axios.post(
        'https://api.zoom.us/v2/users/me/meetings',
        payload,
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response?.data?.password) {
        console.log(response);
      }

      return {
        join_url: response.data.join_url, meetingId: response.data.id,
        password: meetingPassword ?? response.data.password
      };
    } catch (error) {
      console.log(error);
      console.error('Error creating Zoom meeting:', error);
      return {};
    }
  }

  public async cancelMeeting(meetingId: string): Promise<boolean> {
    if (!this.accessToken) {
      await this.authenticate();
    }

    try {
      await axios.delete(`https://api.zoom.us/v2/meetings/${meetingId}`, {
        headers: {
          Authorization: `Bearer ${this.accessToken}`
        }
      });

      return true;
    } catch (error) {
      console.error('Error cancelling Zoom meeting:', error);
      return false;
    }
  }

  // Utility function to generate a random password
  private generatePassword(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@-_';
    let result = '';
    const length = 10; // Maximum length of 10 characters
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  private async authenticate(): Promise<void> {
    try {
      const credentials = Buffer.from(
        `${config.zoom.clientId}:${config.zoom.clientSecret}`
      ).toString('base64');
      const apiUrl = `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${config.zoom.accountId}`;

      // Define the token request parameters
      const tokenRequestData = {
        method: 'POST',
        url: apiUrl,
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      };

      // Send the token request
      const response = await axios(tokenRequestData);
      this.accessToken = response.data.access_token;
    } catch (error) {
      console.error('Error obtaining Zoom access token:', error);
    }
  }
}

export default ZoomMeetingService.getInstance();
