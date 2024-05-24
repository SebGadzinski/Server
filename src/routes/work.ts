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
router.get('/', isAuthenticated, WorkController.getWorkPageData);

router.get(
    '/confirm/:id',
    isAuthenticated,
    WorkController.getWorkConfirmationPageData
);
router.post('/confirm/:id', isAuthenticated, WorkController.confirmWork);

router.post(
    '/cancel/:id',
    isAuthenticated,
    WorkController.getWorkCancelPageData
);
router.post('/cancel/:id', isAuthenticated, WorkController.cancelWork);

router.get(
    '/create',
    isAuthenticated,
    hasRole('admin'),
    WorkController.getWorkEditorPageData
);
router.get(
    '/edit/:id',
    isAuthenticated,
    hasRole('admin'),
    WorkController.getWorkEditorPageData
);
router.post(
    '/upsert',
    isAuthenticated,
    hasRole('admin'),
    WorkController.upsertWork
);

// Payment Routes
router.post('/pay/session', isAuthenticated, WorkPaymentController.generateSessionPaymentIntent);
router.get('/pay/session/confirm', WorkPaymentController.confirmSessionPaymentIntent);
router.post('/pay/attached-card', isAuthenticated, WorkPaymentController.generateAttachedCardPaymentIntent);
router.get('/pay/attached-card/confirm', WorkPaymentController.confirmAttachedCardPaymentIntent);

router.get('/sub/pay/confirm', WorkPaymentController.confirmSubPaymentIntent);
router.post('/sub/paymentMethod/add', isAuthenticated, WorkPaymentController.addCardToSubscription);
router.delete('/sub/paymentMethod/delete/:id', isAuthenticated, WorkPaymentController.deleteCard);
router.post('/sub/paymentHistory', isAuthenticated, WorkPaymentController.getSubPaymentHistory);

router.get(
    '/receipt/:id',
    isAuthenticated,
    WorkPaymentController.generatePaymentReceipt
);

// Template Routes
router.get(
    '/template',
    isAuthenticated,
    hasRole('admin'),
    WorkTemplateController.getWorkTemplatePageData
);
router.post(
    '/template',
    WorkTemplateController.getWorkTemplateComponent
);
router.get(
    '/template/create',
    isAuthenticated,
    hasRole('admin'),
    WorkTemplateController.getWorkTemplateEditorPageData
);
router.get(
    '/template/edit/:id',
    isAuthenticated,
    hasRole('admin'),
    WorkTemplateController.getWorkTemplateEditorPageData
);
router.post(
    '/template/upsert',
    isAuthenticated,
    hasRole('admin'),
    WorkTemplateController.saveWorkTemplate
);
router.delete(
    '/template/delete/:id',
    isAuthenticated,
    hasRole('admin'),
    WorkTemplateController.deleteWorkTemplate
);

router.get(
    '/:id',
    isAuthenticated,
    WorkController.getWorkComponent
);

export default router;
