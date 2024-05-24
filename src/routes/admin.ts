/**
 * @file Defines all data related route patterns.
 * @author Sebastian Gadzinski
 */
import express from 'express';
import multer from 'multer';
import AdminController from '../controllers/AdminController';
import {
    hasRole,
    isAuthenticated
} from '../middleware/authenticationMiddleware';

const router = express.Router({});

router.get(
    '/users',
    isAuthenticated,
    hasRole('admin'),
    AdminController.getUserPageData
);

router.get(
    '/vm',
    isAuthenticated,
    hasRole('admin'),
    AdminController.getVMStatusReports
);

const storage = multer.memoryStorage();
const upload = multer({ storage });
router.post(
    '/vm/downloadVMStatusReport',
    isAuthenticated,
    hasRole('admin'),
    upload.none(),
    AdminController.downloadVMStatusReport
);

router.post('/resetStats', isAuthenticated,
    hasRole('admin'),
    AdminController.resetStats);

router.get(
    '/acceptingWorkState',
    isAuthenticated,
    hasRole('admin'),
    AdminController.getAcceptingWorkState
);
router.post(
    '/acceptingWorkState/save',
    isAuthenticated,
    hasRole('admin'),
    AdminController.saveAcceptingWorkState
);

export default router;
