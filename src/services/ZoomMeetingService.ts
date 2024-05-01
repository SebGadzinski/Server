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

  public async createMeeting(meetingDetails: {
    topic: string,
    startDate: Date,
    duration: number,
    alternativeHosts?: string[],
    password?: boolean
  }): Promise<{ join_url?: string; meetingId?: string, password?: string }> {
    return this.request('post', 'https://api.zoom.us/v2/users/me/meetings', meetingDetails);
  }

  public async cancelMeeting(meetingId: string): Promise<boolean> {
    return this.request('delete', `https://api.zoom.us/v2/meetings/${meetingId}`);
  }

  private async request(method: string, url: string, data?: any): Promise<any> {
    if (!this.accessToken) {
      await this.authenticate();
    }

    try {
      const config = {
        method: method,
        url: url,
        headers: { 'Authorization': `Bearer ${this.accessToken}` },
        data: data ? this.prepareMeetingData(data) : null
      };

      const response = await axios(config);
      return method === 'post' ? this.formatMeetingResponse(response) : true;
    } catch (error) {
      if (error.response && error.response.status === 401) {
        await this.authenticate();
        return this.request(method, url, data);
      }
      console.error(`Error handling Zoom request (${method}):`, error);
      return method === 'post' ? {} : false;
    }
  }

  private prepareMeetingData(details: {
    topic: string,
    startDate: Date,
    duration: number,
    alternativeHosts?: string[],
    password?: boolean
  }): any {
    let meetingPassword;

    if (details.password) {
      meetingPassword = this.generatePassword();
    }

    const startTime = details.startDate.toISOString().replace('.000Z', 'Z');
    const payload: any = {
      topic: details.topic,
      type: 2,
      start_time: startTime,
      duration: details.duration,
      settings: {},
      ...(details.password && { password: meetingPassword })
    };

    if (details.alternativeHosts) {
      payload.settings.alternative_hosts = details.alternativeHosts.join(',');
    }

    return payload;
  }

  private formatMeetingResponse(response: any): { join_url?: string; meetingId?: string, password?: string } {
    const data = response.data;
    return {
      join_url: data.join_url,
      meetingId: data.id,
      password: data.password
    };
  }

  private generatePassword(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@-_';
    let result = '';
    for (let i = 0; i < 10; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  private async authenticate(): Promise<void> {
    const credentials = Buffer.from(`${config.zoom.clientId}:${config.zoom.clientSecret}`).toString('base64');
    const apiUrl = `https://zoom.us/oauth/token?grant_type=client_credentials`;

    const tokenRequestData = {
      method: 'POST',
      url: apiUrl,
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    };

    const response = await axios(tokenRequestData);
    this.accessToken = response.data.access_token;
  }
}

export default ZoomMeetingService.getInstance();
