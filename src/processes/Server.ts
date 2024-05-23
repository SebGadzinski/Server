/**
 * @file Runs the server attached to front end via https
 * @author Sebastian Gadzinski
 */

import { exec } from 'child_process';
import cors from 'cors';
import express from 'express';
import fs from 'fs';
import https from 'https';
import util from 'util';

import config from '../config';
import { IPSecurity } from '../middleware/securityMiddleware';
import {
  appRoutes, authenticationRoutes,
  browseRoutes, dataRoutes, meetingRoutes,
  userRoutes, vmRoutes, workRoutes
} from '../routes';
import ipService from '../services/IPService';
import Process from './_Process';

const execAsync = util.promisify(exec);

// When a new certificate is added you need to add it to the store so that this WINDOWS COMP accepts it
const CERT_ADD = `certutil -addstore -f "Root" "C:\\WorkTemp\\ssl\\FIND_IP.cert"`;

class Server extends Process {
  protected app: any;

  public async run() {
    await super.run();
    if (config.useHTTPS) {
      const options = await this.validateHttps();
      this.initilizeExpress(options);
    } else {
      this.initilizeExpress();
    }
  }

  private async validateHttps(): Promise<any> {
    const ip = ipService.getInternalIPv4();
    const options: any = {
      key: '',
      cert: ''
    };

    if (['production', 'staging'].includes(process.env.NODE_ENV)) {
      const keyPath = config.sslKeyPath;
      const certPath = config.sslCertPath;

      options.key = fs.readFileSync(keyPath);
      options.cert = fs.readFileSync(certPath);
    } else {
      const keyPath = `C:\\WorkTemp\\ssl\\${ip}.key`;
      const certPath = `C:\\WorkTemp\\ssl\\${ip}.cert`;

      // Check if the certificate and key for this IP already exist
      if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
        // If not, generate them
        await this.generateCertificate(ip, keyPath, certPath);
      }

      options.key = fs.readFileSync(keyPath);
      options.cert = fs.readFileSync(certPath);
    }

    return options;
  }

  private async generateCertificate(
    ip: string,
    keyPath: string,
    certPath: string
  ): Promise<void> {
    // Ensure the ssl directory exists
    const sslDir = 'C:\\WorkTemp\\ssl';
    if (!fs.existsSync(sslDir)) {
      fs.mkdirSync(sslDir);
    }

    // Generate a private key and a self-signed certificate with SAN for IP and localhost
    const cmdKey = `"C:\\Program Files\\Git\\usr\\bin\\openssl.exe" genrsa -out ${keyPath} 2048`;
    const cmdCert = `"C:\\Program Files\\Git\\usr\\bin\\openssl.exe" req -new -x509 -key ${keyPath} -out ${certPath} -days 365 -subj "/CN=localhost" -addext "subjectAltName = IP:${ip},DNS:localhost"`;
    // MAKE SURE YOU RUN CERT_ADD as Administator on windows

    try {
      await execAsync(cmdKey);
      await execAsync(cmdCert);
    } catch (error) {
      console.error('Error generating SSL certificate:', error);
    }
  }

  private initilizeExpress(httpsOptions?: any) {
    // Initialize Express.
    this.app = express();
    if (
      process.env.NODE_ENV === 'development' ||
      process.env.NODE_ENV === 'test' || !config.useHTTPS
    ) {
      this.app.use(cors());
    }
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: true }));
    // Map routes.
    this.app.use(IPSecurity);
    this.app.use('/api/user', userRoutes);
    this.app.use('/api/auth', authenticationRoutes);
    this.app.use('/api/app', appRoutes);
    this.app.use('/api/data', dataRoutes);
    this.app.use('/api/browse', browseRoutes);
    this.app.use('/api/meeting', meetingRoutes);
    this.app.use('/api/vm', vmRoutes);
    this.app.use('/api/work', workRoutes);

    if (httpsOptions) {
      // Create HTTPS server and start listening.
      const httpsServer = https.createServer(httpsOptions, this.app);
      httpsServer.listen(config.port, () => {
        console.log(`App listening on ${config.domain}`);
      });
    } else {
      // Start the app.
      this.app.listen(config.port, () => {
        console.log(`App listening on ${config.domain}`);
      });
    }
  }

}

const server = new Server('Server', { connectToDb: true, startMessage: 'Starting server...' });
server.run();
