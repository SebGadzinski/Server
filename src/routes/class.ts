import express from 'express';
import ClassController from '../controllers/ClassController';
import {
    isAuthenticated
} from '../middleware/authenticationMiddleware';

const router = express.Router({});

router.post(
    '/work/class/enroll/status/:id',
    isAuthenticated,
    ClassController.enrollmentStatus
);
router.post(
    '/work/class/enroll/:id',
    isAuthenticated,
    ClassController.enroll
);
router.post(
    '/work/class/use/single-session/:id',
    isAuthenticated,
    ClassController.useSingleSession
);

router.get('/getClassesPageData', isAuthenticated, ClassController.getClassesPageData);

router.get('/classes/join/:workId', isAuthenticated, ClassController.getJoinClassLink);

router.post('/classes/drop/:workId', isAuthenticated, ClassController.dropClass);

export default router;
