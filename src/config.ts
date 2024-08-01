/**
 * @file Defines all constants required for application configuration across Processes (src/Processes/*)
 * @author Sebastian Gadzinski
 */

import _ from 'lodash';
import os from 'os';
import alignable from './configs/alignable.json';
import firebaseServiceAccount from './configs/firebase.json';
import googleServiceAPI from './configs/google-services.json';
import sendGrid from './configs/sendGrid.json';
// import verifalia from './configs/verifalia.json';
import zoom from './configs/zoom.json';
import mongoConstants from './constants/mongoConstants.json';
import ipService from './services/IPService';
import MongoDBService from './services/MongoDBService';

// Set to whats needed
const useHTTPS = process.env.NODE_ENV === 'production' ? false : false;

const stripe = {
  classes: process.env.STRIPE_SK_CLASSES,
  software: process.env.STRIPE_SK_SOFTWARE,
  photography: process.env.STRIPE_SK_PHOTOGRAPHY,
  videography: process.env.STRIPE_SK_VIDEOGRAPHY,
  design: process.env.STRIPE_SK_DESIGN
};

const config = {
  tempDir: process.env.TEMP_DIR,
  databaseUrl: process.env.MONGO_DB,
  csgenerator: {
    databaseUrl: process.env.CSGENERATOR_MONGO_DB_URL,
    databaseName: process.env.CSGENERATOR_MONGO_DB_DATABASE_NAME,
  },
  port: parseInt(process.env.PORT, 10),
  saltRounds: parseInt(process.env.SALT_ROUNDS, 10),
  secret: process.env.SECRET,
  refreshSecret: process.env.REFRESH_SECRET,
  tokenExpirySeconds: parseInt(
    process.env.TOKEN_EXPIRY_SECONDS,
    10
  ),
  refreshTokenExpiryDays: parseInt(
    process.env.REFRESH_TOKEN_EXPIRY_DAYS,
    10
  ),
  domain: process.env.DOMAIN,
  frontEndDomain: process.env.FRONT_END_DOMAIN,
  company: process.env.COMPANY,
  email: {
    alert: process.env.ALERT_EMAIL,
    noReply: process.env.NO_REPLY_EMAIL
  },
  appVersionDirectory: process.env.APP_VERSION_DIRECTORY,
  sendGrid,
  firebaseServiceAccount,
  downloadAppEndpoint: process.env.DOWNLOAD_APP_ENDPOINT,
  googleServiceAPI,
  zoom,
  stripe,
  sendEmailStatus: process.env.SEND_EMAIL_STATUS,
  useHTTPS,
  acceptingWork: process.env.ACCEPTING_WORK,
  sslKeyPath: process.env.SSL_KEY_PATH,
  sslCertPath: process.env.SSL_CERT_PATH,
  appNotificationStatus: process.env.APP_NOTIFICATIONS_STATUS,
  zoomMeetingEmail: 'sebastiangadzinskiwork@gmail.com',
  alignable
};

const internalIpV4 = ipService.getInternalIPv4();
const runningCapacitator = false;

function replaceLocalhost(obj) {
  return _.transform(obj, (result, value, key) => {
    if (_.isString(value)) {
      let newValue = value;

      // Replace 'http://' with 'https://' if useHTTPS is true
      if (useHTTPS) {
        newValue = newValue.replace('http://', 'https://');
      }

      // Replace 'localhost' with the internal IP
      newValue = newValue.replace(/localhost/g, internalIpV4);

      result[key] = newValue;
    } else if (_.isObject(value) && !_.isArray(value)) {
      result[key] = replaceLocalhost(value); // Recursive call for nested objects
    } else {
      result[key] = value;
    }
  }, {});
}

const updatedConfig = replaceLocalhost(config);

export default updatedConfig;

export const csgeneratorMongo = new MongoDBService(
  updatedConfig.csgenerator.databaseUrl
  , updatedConfig.csgenerator.databaseName
);

export const c = {
  ...mongoConstants,
};
