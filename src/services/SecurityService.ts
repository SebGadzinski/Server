import express from 'express';
import geoip from 'geoip-lite';
import config from '../config';
import { IPData } from '../models'; // Adjust the path as needed
import EmailService from './EmailService';

class SecurityService {
  public static getInstance(): SecurityService {
    if (!SecurityService.instance) {
      SecurityService.instance = new SecurityService();
    }
    return SecurityService.instance;
  }

  private static instance: SecurityService;
  private allowedCountries: Set<string>;

  private constructor() {
    // Initialize with allowed countries
    this.allowedCountries = new Set(['CA', 'US', 'MX']); // Canada, United States, Mexico
    this.ipFilterMiddleware = this.ipFilterMiddleware.bind(this);
  }

  public async blockIP(ipAddress: string): Promise<void> {
    await IPData.findOneAndUpdate(
      { ipAddress },
      { ipAddress, isBlocked: true },
      { upsert: true, setDefaultsOnInsert: true }
    );
  }

  public async checkAndBlockIP(ipAddress: string): Promise<void> {
    ipAddress = this.formatIPAddress(ipAddress); // Format IP address
    const ipData =
      (await IPData.findOne({ ipAddress })) ||
      (await new IPData({ ipAddress }).save());
    ipData.count++;
    if (ipData.count >= 5) {
      if (!ipData.isBlocked) {
        const geo = geoip.lookup(ipAddress);
        const body = `=== IP ===<br>${ipAddress}<br>=== Geo Info ===<br>${geo}<br>=== Database Info ===<br>${JSON.stringify(
          ipData.toJSON()
        ).replace(/\n/g, '<br>')}`;
        EmailService.sendAlertEmail(
          config.sendGrid.email.alert,
          'IP Blocked',
          body
        );
      }
      ipData.isBlocked = true;
    }
    await ipData.save();
  }

  public async isIPBlocked(ipAddress: string): Promise<boolean> {
    ipAddress = this.formatIPAddress(ipAddress); // Format IP address
    const ipData = await IPData.findOne({ ipAddress });
    return ipData ? ipData.isBlocked : false;
  }

  public isCountryAllowed(ipAddress: string): boolean {
    ipAddress = this.formatIPAddress(ipAddress); // Format IP address
    const geo = geoip.lookup(ipAddress);

    return (
      // Coffee shop and home
      ipAddress === '192.168.200.43' ||
      ipAddress === '192.168.0.26' ||
      (geo && this.allowedCountries.has(geo.country))
    );
  }

  public ipFilterMiddleware(req, res, next: express.NextFunction) {
    const ipAddress = this.formatIPAddress(req.ip); // Format IP address
    this.isIPBlocked(ipAddress)
      .then((isBlocked) => {
        if (isBlocked || !this.isCountryAllowed(ipAddress)) {
          res.status(499).send('Access denied');
        } else {
          next();
        }
      })
      .catch((error) => {
        // Handle the error appropriately
        console.error(error);
        res.status(500).send('An error occurred');
      });
  }

  private formatIPAddress(ipAddress: string): string {
    if (ipAddress.startsWith('::ffff:')) {
      return ipAddress.substring(7);
    }
    return ipAddress;
  }
}

export default SecurityService;
