/**
 * @file JWT authentication middleware.
 * @author Sebastian Gadzinski
 */
import express from 'express';
import jwt from 'jsonwebtoken';
import config from '../config';
import { Token } from '../models';
import SecurityService from '../services/SecurityService';

// Request is any because we want to assign the decoded user object to it.
const isAuthenticated = (req: any, res: any, next: express.NextFunction) => {
  let token = '';
  try {
    const authHeader = req.headers.authorization;
    token = authHeader && authHeader.split(' ')[1];
  } catch (err) {
    return res.status(403).json({
      message: 'No token found.',
      success: false
    });
  }

  const allowPassToSignUp = req.path.endsWith('/meeting/book')
    || req.path.includes('/classes/enroll/status');
  const allowPassFromEmailUnConfirmed = req.path.endsWith('/emailConfirmStatus');

  let decoded: any = {};
  try {
    decoded = jwt.verify(token, config.secret);
  } catch (err) {
    if (!allowPassToSignUp) {
      return res.status(401).json({
        message: 'You are not allowed to access this resource.',
        success: false
      });
    }
  }

  if (!decoded || !decoded?.data?.email) {
    if (!allowPassToSignUp) {
      return res.status(403).json({
        message: 'You are not allowed to access this resource.',
        success: false
      });
    }
  }

  // if no user at all and allowPassToSignUp dont go in here
  if (!(!decoded?.data && allowPassToSignUp)
    && !decoded?.data?.emailConfirmed && !req.path.endsWith('/sendEmailConfirmation')) {
    if (!allowPassFromEmailUnConfirmed) {
      return res.status(477).json({
        message: 'Cannot validate your email address.',
        success: false,
        onError: req?.body?.onError
      });
    }
  }

  if (decoded) req.user = decoded;

  next();
};

// If this is a user request, this verifies the user being requested on is the user calling. Or this is a admin.
const isUser = (options: { minRole?: string | null; needBoth?: boolean }) => {
  const { minRole = null, needBoth = false } = options;

  return async (req: any, res: any, next: express.NextFunction) => {
    let compareId = req.params.id;
    if (!compareId && req.params.token) {
      const foundToken = await Token.findOne({ value: req.params.token });
      compareId = foundToken?.referenceId;
    }
    const passed =
      (needBoth &&
        req.user.data.id &&
        compareId === req.user.data.id &&
        req.user.data.roles.includes(minRole)) ||
      (!needBoth &&
        req.user.data.id &&
        (compareId === req.user.data.id ||
          req.user.data.roles.includes(minRole)));

    if (!passed) {
      await SecurityService.checkAndBlockIP(req.ip);
      return res.status(403).json({
        message: 'You are not allowed to access this resource.',
        success: false
      });
    }

    next();
  };
};

const hasRole = (role: string) => {
  return async (req, res, next) => {
    if (!req.user || !req.user.data.roles.includes(role)) {
      await SecurityService.checkAndBlockIP(req.ip);
      return res.status(403).json({
        message: 'You are not allowed to access this resource.',
        success: false
      });
    }
    next();
  };
};

export { isAuthenticated, isUser, hasRole };
