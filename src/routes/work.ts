import express from 'express';
import {
    WorkController,
    WorkPaymentController,
    WorkTemplateController
} from '../controllers';
import {
    hasRole,
    isAuthenticated
} from '../middleware/authenticationMiddleware';

const router = express.Router({});

// General Routes
router.get('/getWorkPageData', isAuthenticated, WorkController.getWorkPageData);
router.post(
    '/getWorkConfirmationPageData',
    isAuthenticated,
    WorkController.getWorkConfirmationPageData
);

router.post('/work/confirm/:id', isAuthenticated, WorkController.confirmWork);
router.post('/work/cancel/:id', isAuthenticated, WorkController.cancelWork);

router.post(
    '/getWorkCancelPageData',
    isAuthenticated,
    WorkController.getWorkCancelPageData
);
router.get(
    '/work/:id',
    isAuthenticated,
    WorkController.getWorkComponent
);

router.post(
    '/getWorkEditorPageData',
    isAuthenticated,
    WorkController.getWorkEditorPageData
);

router.post(
    '/work/upsert',
    isAuthenticated,
    hasRole('admin'),
    WorkController.upsertWork
);

// Payment Routes
router.post('/work/pay/session', isAuthenticated, WorkPaymentController.generateSessionPaymentIntent);
router.get('/work/pay/session/confirm', WorkPaymentController.confirmSessionPaymentIntent);

router.post('/work/pay/attached-card', isAuthenticated, WorkPaymentController.generateAttachedCardPaymentIntent);
router.get('/work/pay/attached-card/confirm', WorkPaymentController.confirmAttachedCardPaymentIntent);

router.get('/work/sub/pay/confirm', WorkPaymentController.confirmSubPaymentIntent);

router.post('/work/sub/paymentHistory', isAuthenticated, WorkPaymentController.getSubPaymentHistory);

router.post('/work/sub/paymentMethod/add', isAuthenticated, WorkPaymentController.addCardToSubscription);

router.delete('/work/sub/paymentMethod/delete/:id', isAuthenticated, WorkPaymentController.deleteCard);
router.get(
    '/work/receipt/:id',
    isAuthenticated,
    WorkPaymentController.generatePaymentReceipt
);

// Template Routes
router.post(
    '/work/template',
    WorkTemplateController.getWorkTemplateComponent
);
router.post(
    '/work/template/find',
    isAuthenticated,
    hasRole('admin'),
    WorkTemplateController.getWorkTemplates
);
router.post(
    '/work/template/save',
    isAuthenticated,
    hasRole('admin'),
    WorkTemplateController.saveWorkTemplate
);
router.get(
    '/getWorkTemplatePageData',
    isAuthenticated,
    hasRole('admin'),
    WorkTemplateController.getWorkTemplatePageData
);
router.post(
    '/getWorkTemplateEditorPageData',
    isAuthenticated,
    hasRole('admin'),
    WorkTemplateController.getWorkTemplateEditorPageData
);
router.delete(
    '/work/template/delete/:id',
    isAuthenticated,
    hasRole('admin'),
    WorkTemplateController.deleteWorkTemplate
);

export default router;
