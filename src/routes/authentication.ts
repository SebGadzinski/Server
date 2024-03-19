/**
 * @file Defines all authentication related route patterns.
 * @author Sebastian Gadzinski
 */
import express from 'express';
import AuthenticationController from '../controllers/AuthenticationController';
import {
  isAuthenticated,
  isUser
} from '../middleware/authenticationMiddleware';

const router = express.Router({});

router.post('/', AuthenticationController.login);

router.post('/signUp', AuthenticationController.signUp);

// Refresh
router.post('/refresh', AuthenticationController.refreshToken);

// EmailConfirmation
router.post(
  '/:id/sendEmailConfirmation',
  isAuthenticated,
  isUser({ minRole: 'admin' }),
  // is self or is admin
  AuthenticationController.sendEmailConfirmation
);
router.get(
  '/emailConfirmStatus',
  isAuthenticated,
  AuthenticationController.emailConfirmStatus
);
router.post(
  '/sendEmailConfirmation',
  isAuthenticated,
  // is self or is admin
  AuthenticationController.sendEmailConfirmation
);

router.post('/:token/confirmEmail', AuthenticationController.confirmEmail);

// Reseting Password
router.post(
  '/:id/sendEmailResetPassword',
  isAuthenticated,
  isUser({ minRole: 'admin' }),
  // is self or is admin
  AuthenticationController.sendEmailResetPassword
);
router.post(
  '/sendEmailResetPassword',
  AuthenticationController.sendEmailResetPassword
);

router.post('/:token/resetPassword', AuthenticationController.resetPassword);

router.post(
  '/:id/logout',
  isAuthenticated,
  isUser({ minRole: 'admin' }),
  // is self or is admin
  AuthenticationController.logout
);

router.post(
  '/logout',
  isAuthenticated,
  // is self or is admin
  AuthenticationController.logout
);

export default router;
