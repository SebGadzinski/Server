/**
 * @file Defines all data related route patterns.
 * @author Sebastian Gadzinski
 */
import express from 'express';
import multer from 'multer';
import DataController from '../controllers/DataController';
import {
  hasRole,
  isAuthenticated
} from '../middleware/authenticationMiddleware';

const router = express.Router({});

router.get('/home', DataController.getHomePageData);

router.get(
  '/admin/getUserPageData',
  isAuthenticated,
  hasRole('admin'),
  DataController.getUserPageData
);

router.get(
  '/admin/getVMStatusReport',
  isAuthenticated,
  hasRole('admin'),
  DataController.getVMStatusReports
);

const storage = multer.memoryStorage();
const upload = multer({ storage });
router.post(
  '/admin/vm/downloadVMStatusReport',
  isAuthenticated,
  hasRole('admin'),
  upload.none(),
  DataController.downloadVMStatusReport
);

router.post('/resetStats', isAuthenticated,
  hasRole('admin'),
  DataController.resetStats);

router.get(
  '/admin/acceptingWorkState',
  isAuthenticated,
  hasRole('admin'),
  DataController.getAcceptingWorkState
);
router.post(
  '/admin/acceptingWorkState/save',
  isAuthenticated,
  hasRole('admin'),
  DataController.saveAcceptingWorkState
);

router.post('/getProfile', isAuthenticated, DataController.getProfile);

router.post('/saveProfile', isAuthenticated, DataController.saveProfile);

export default router;
