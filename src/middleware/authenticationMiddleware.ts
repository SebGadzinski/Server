/**
 * @file JWT authentication middleware.
 * @author Ivan Kockarevic
 */
import express from 'express';
import jwt from 'jsonwebtoken';
import config from '../config';
import { Token } from '../models';

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

  let decoded: any = {};
  try {
    decoded = jwt.verify(token, config.secret);
  } catch (err) {
    console.error(err);
    return res.status(401).json({
      message: 'You are not allowed to access this resource.',
      success: false
    });
  }

  if (!decoded || !decoded.data.email) {
    return res.status(403).json({
      message: 'You are not allowed to access this resource.',
      success: false
    });
  }

  req.user = decoded;

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
      return res.status(403).json({
        message: 'You are not allowed to access this resource.',
        success: false
      });
    }

    next();
  };
};

const hasRole = (
  role: string,
  req: any,
  res: any,
  next: express.NextFunction
) => {
  if (!req.user.data.roles.includes(role)) {
    return res.status(403).json({
      message: 'You are not allowed to access this resource.',
      success: false
    });
  }

  next();
};

export { isAuthenticated, isUser, hasRole };
