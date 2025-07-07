import { Router } from 'express';
import {
  createUser,
  getUser,
  uploadCV,
  handleCVUpload,
  getSignupMetadata,
  getUserProfile,
  createUserProfile
} from '../src/controllers/user.controller.js';
import { authenticate } from '../src/middlewares/auth.middleware.js';

const router = Router();

// Legacy routes
router.get('/register/user', getSignupMetadata);
router.post('/', createUser);
router.get('/:userId', getUser);

// New profile routes
router.get('/profile', getUserProfile);
router.post('/profile', uploadCV, createUserProfile);

// CV upload route
router.post('/:userId/cv', uploadCV, handleCVUpload);

export default router;
