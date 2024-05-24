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

router.post('/getProfile', isAuthenticated, DataController.getProfile);

router.post('/saveProfile', isAuthenticated, DataController.saveProfile);

export default router;
