/**
 * @file Defines all data related route patterns.
 * @author Sebastian Gadzinski
 */
import express from 'express';
import multer from 'multer';
import DataController from '../controllers/DataController';
import {
  hasRole,
  isAuthenticated,
  isUser
} from '../middleware/authenticationMiddleware';

const router = express.Router({});

router.get('/getHomePageData', DataController.getHomePageData);
router.get('/getHomePageDataV2', DataController.getHomePageDataV2);

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

router.post('/work/confirm/:id', isAuthenticated, DataController.confirmWork);

router.post(
  '/getWorkCancelPageData',
  isAuthenticated,
  DataController.getWorkCancelPageData
);

router.post('/work/cancel/:id', isAuthenticated, DataController.cancelWork);

router.get(
  '/work/:id',
  isAuthenticated,
  DataController.getWorkComponent
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

router.post('/work/pay/session', isAuthenticated, DataController.generateSessionPaymentIntent);
router.get('/work/pay/session/confirm', DataController.confirmSessionPaymentIntent);

router.post('/work/pay/attached-card', isAuthenticated, DataController.generateAttachedCardPaymentIntent);
router.get('/work/pay/attached-card/confirm', DataController.confirmAttachedCardPaymentIntent);

router.get('/work/sub/pay/confirm', DataController.confirmSubPaymentIntent);

router.post('/work/sub/paymentHistory', isAuthenticated, DataController.getSubPaymentHistory);

router.post('/work/sub/paymentMethod/add', isAuthenticated, DataController.addCardToSubscription);

router.delete('/work/sub/paymentMethod/delete/:id', isAuthenticated, DataController.deleteCard);

router.post(
  '/work/template',
  DataController.getWorkTemplateComponent
);
router.post(
  '/work/template/find',
  isAuthenticated,
  hasRole('admin'),
  DataController.getWorkTemplates
);
router.post(
  '/work/template/save',
  isAuthenticated,
  hasRole('admin'),
  DataController.saveWorkTemplate
);
router.get(
  '/getWorkTemplatePageData',
  isAuthenticated,
  hasRole('admin'),
  DataController.getWorkTemplatePageData
);
router.post(
  '/getWorkTemplateEditorPageData',
  isAuthenticated,
  hasRole('admin'),
  DataController.getWorkTemplateEditorPageData
);
router.delete(
  '/work/template/delete/:id',
  isAuthenticated,
  hasRole('admin'),
  DataController.deleteWorkTemplate
);

router.post(
  '/work/class/enroll/status/:id',
  isAuthenticated,
  DataController.enrollmentStatus
);
router.post(
  '/work/class/enroll/:id',
  isAuthenticated,
  DataController.enroll
);
router.post(
  '/work/class/use/single-session/:id',
  isAuthenticated,
  DataController.useSingleSession
);
router.get(
  '/work/receipt/:id',
  isAuthenticated,
  DataController.generatePaymentReceipt
);

router.get('/getClassesPageData', isAuthenticated, DataController.getClassesPageData);

router.get('/classes/join/:workId', isAuthenticated, DataController.getJoinClassLink);

router.post('/classes/drop/:workId', isAuthenticated, DataController.dropClass);

export default router;
