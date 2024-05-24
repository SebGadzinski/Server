import express from 'express';
import ClassController from '../controllers/ClassController';
import {
    isAuthenticated
} from '../middleware/authenticationMiddleware';

const router = express.Router({});

router.get('/', isAuthenticated, ClassController.getClassesPageData);

router.post(
    '/enroll/status/:id',
    isAuthenticated,
    ClassController.enrollmentStatus
);
router.post(
    '/enroll/:id',
    isAuthenticated,
    ClassController.enroll
);

router.get('/join/:workId', isAuthenticated, ClassController.getJoinClassLink);
router.post('/drop/:workId', isAuthenticated, ClassController.dropClass);

router.post(
    '/use/single-session/:id',
    isAuthenticated,
    ClassController.useSingleSession
);

export default router;
