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

router.get('/getHomePageData', DataController.getHomePageData);

router.post('/getCategoryPageData', DataController.getCategoryPageData);

router.post('/getServicePageData', DataController.getServicePageData);

router.post('/getMeetingPageData', DataController.getMeetingPageData);

router.post(
  '/meeting/findUnavailableDurations',
  DataController.findUnavailableDurations
);

router.post('/meeting/book', isAuthenticated, DataController.bookMeeting);

export default router;
