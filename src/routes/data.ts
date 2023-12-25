/**
 * @file Defines all authentication related route patterns.
 * @author Sebastian Gadzinski
 */
import express from 'express';
import DataController from '../controllers/DataController';
import {
  hasRole,
  isAuthenticated,
  isUser
} from '../middleware/authenticationMiddleware';

const router = express.Router({});

router.get('/col', isAuthenticated, DataController.getCollection);

router.get('/getHomePageData', DataController.getHomePageData);

router.post('/getCategoryPageData', DataController.getCategoryPageData);

router.post('/getServicePageData', DataController.getServicePageData);

router.post('/getMeetingPageData', DataController.getMeetingPageData);

router.post(
  '/meeting/findUnavailableDurations',
  DataController.findUnavailableDurations
);

router.post('/meeting/book', isAuthenticated, DataController.bookMeeting);

router.get('/getWorkPageData', isAuthenticated, DataController.getWorkPageData);

router.post(
  '/getWorkConfirmationPageData',
  isAuthenticated,
  DataController.getWorkConfirmationPageData
);

router.post('/work/confirm', isAuthenticated, DataController.confirmWork);

router.post(
  '/getWorkCancelPageData',
  isAuthenticated,
  DataController.getWorkCancelPageData
);

router.post('/work/cancel', isAuthenticated, DataController.cancelWork);

router.post(
  '/work/viewComponent',
  isAuthenticated,
  DataController.getViewComponent
);

router.post(
  '/getWorkEditorPageData',
  isAuthenticated,
  DataController.getWorkEditorPageData
);

router.post(
  '/work/upsert',
  isAuthenticated,
  hasRole('admin'),
  DataController.upsertWork
);

router.post('/work', isAuthenticated, DataController.getWorkComponent);

export default router;
