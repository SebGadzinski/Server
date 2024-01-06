/**
 * @file Defines all constants required for application configuration.
 * @author Sebastian Gadzinski
 */
import env from '../env.config';
import chatGPT from './configs/chatGPT.json';
import firebaseServiceAccount from './configs/firebase.json';
import googleServiceAPI from './configs/google-services.json';
import sendGrid from './configs/sendGrid.json';
import stripe from './configs/stripe.json';
import zoom from './configs/zoom.json';

const config = {
  databaseUrl: env.getEnvironmentVariable('MONGO_DB'),
  port: parseInt(env.getEnvironmentVariable('PORT'), 10),
  saltRounds: parseInt(env.getEnvironmentVariable('SALT_ROUNDS'), 10),
  secret: env.getEnvironmentVariable('SECRET'),
  refreshSecret: env.getEnvironmentVariable('REFRESH_SECRET'),
  tokenExpirySeconds: parseInt(
    env.getEnvironmentVariable('TOKEN_EXPIRY_SECONDS'),
    10
  ),
  refreshTokenExpiryDays: parseInt(
    env.getEnvironmentVariable('REFRESH_TOKEN_EXPIRY_DAYS'),
    10
  ),
  domain: env.getEnvironmentVariable('DOMAIN'),
  frontEndDomain: env.getEnvironmentVariable('FRONT_END_DOMAIN'),
  company: env.getEnvironmentVariable('COMPANY'),
  email: {
    alert: env.getEnvironmentVariable('ALERT_EMAIL'),
    noReply: env.getEnvironmentVariable('NO_REPLY_EMAIL')
  },
  appVersionDirectory: env.getEnvironmentVariable('APP_VERSION_DIRECTORY'),
  sendGrid,
  firebaseServiceAccount,
  downloadAppEndpoint: env.getEnvironmentVariable('DOWNLOAD_APP_ENDPOINT'),
  googleServiceAPI,
  chatGPT,
  zoom,
  stripe
};

export default config;
