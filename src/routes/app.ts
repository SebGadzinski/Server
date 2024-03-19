/**
 * @file Defines all app related route patterns.
 * @author Sebastian Gadzinski
 */
import express from 'express';
import AppController from '../controllers/AppController';
import {
  isAuthenticated,
  isUser
} from '../middleware/authenticationMiddleware';

const router = express.Router({});

router.post('/checkForUpdate', AppController.checkForUpdate);

router.post('/getLatestVersion', AppController.getLatestVersion);

// TODO: Get capgo to download from here instead of directly from the file system
// router.get('/download/:version', AppController.download);

router.post(
  '/updateNotificationSubscription',
  isAuthenticated,
  AppController.updateNotificationSubscription
);

export default router;
