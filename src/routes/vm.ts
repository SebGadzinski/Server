/**
 * @file Defines all user related route patterns.
 * @author Sebastian Gadzinski
 */
import express from 'express';
import VMController from '../controllers/VMController';
import {
    hasRole,
    isAuthenticated
} from '../middleware/authenticationMiddleware';

const router = express.Router({});

router.post('/gitPullServer', isAuthenticated,
    hasRole('admin'),
    VMController.gitPull);

router.post('/reseedDB', isAuthenticated,
    hasRole('admin'),
    VMController.reseedDB);

export default router;
