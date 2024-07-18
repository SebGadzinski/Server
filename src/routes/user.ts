/**
 * @file Defines all user related route patterns.
 * @author Sebastian Gadzinski
 */
import express from 'express';

import UserController from '../controllers/UserController';
import {
  isAuthenticated,
  isUser
} from '../middleware/authenticationMiddleware';

const router = express.Router({});

// Profile
router.get('/profile', isAuthenticated, UserController.getProfile);
router.get('/profile/:id', isAuthenticated, isUser({ minRole: 'admin' }), UserController.getProfile);

router.post('/profile/save', isAuthenticated, UserController.saveProfile);

// Create
router.post(
  '/',
  isAuthenticated,
  isUser({ minRole: 'admin' }),
  UserController.create
);

// Read
router.get('/', isAuthenticated, UserController.getAll);
router.get('/:id', isAuthenticated, UserController.get);

// Update
router.put(
  '/:id',
  isAuthenticated,
  isUser({ minRole: 'admin' }),
  UserController.update
);

// Delete
router.delete(
  '/:id',
  isAuthenticated,
  isUser({ minRole: 'admin' }),
  UserController.delete
);

export default router;
