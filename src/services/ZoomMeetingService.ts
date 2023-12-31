import axios from 'axios';
import querystring from 'querystring';
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

  public async createMeeting(
    topic: string,
    startDate: Date,
    duration: number
  ): Promise<{ join_url: string | null; meetingId: string | null }> {
    if (!this.accessToken) {
      await this.authenticate();
    }

    try {
      const startTime = startDate.toISOString().replace('.000Z', 'Z');

      const response = await axios.post(
        'https://api.zoom.us/v2/users/me/meetings',
        {
          topic,
          type: 2,
          start_time: startTime,
          duration
        },
        {
          headers: {
            'Authorization': `Bearer ${this.accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return { join_url: response.data.join_url, meetingId: response.data.id };
    } catch (error) {
      console.error('Error creating Zoom meeting:', error);
      return { join_url: null, meetingId: null };
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
