/**
 * @file Defines all authentication related route patterns.
 * @author Sebastian Gadzinski
 */
import express from 'express';
import DataController from '../controllers/DataController';
import {
  isAuthenticated,
  isUser
} from '../middleware/authenticationMiddleware';

const router = express.Router({});

router.post('/col', isAuthenticated, DataController.getCollection);

router.get('/getHomePageData', isAuthenticated, DataController.getHomePageData);

router.post(
  '/getCategoryPageData',
  isAuthenticated,
  DataController.getCategoryPageData
);

router.post(
  '/getServicePageData',
  isAuthenticated,
  DataController.getServicePageData
);

router.post(
  '/getMeetingPageData',
  isAuthenticated,
  DataController.getMeetingPageData
);

router.post(
  '/meeting/findAvailableDurations',
  isAuthenticated,
  DataController.findAvailableDurations
);

export default router;
