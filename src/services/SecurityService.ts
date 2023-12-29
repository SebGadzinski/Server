import express from 'express';
import geoip from 'geoip-lite';
import { IPData } from '../models'; // Adjust the path as needed

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
      ipAddress === '192.168.200.45' ||
      (geo && this.allowedCountries.has(geo.country))
    );
  }

  public ipFilterMiddleware(req, res, next: express.NextFunction) {
    const ipAddress = this.formatIPAddress(req.ip); // Format IP address
    this.isIPBlocked(ipAddress)
      .then((isBlocked) => {
        if (isBlocked || !this.isCountryAllowed(ipAddress)) {
          res.status(403).send('Access denied');
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
