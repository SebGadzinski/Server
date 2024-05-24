import express from 'express';
import MeetingController from '../controllers/MeetingController';
import {
    isAuthenticated
} from '../middleware/authenticationMiddleware';

const router = express.Router({});
router.post('/', MeetingController.getMeetingPageData);
router.post('/book', isAuthenticated, MeetingController.bookMeeting);

export default router;
