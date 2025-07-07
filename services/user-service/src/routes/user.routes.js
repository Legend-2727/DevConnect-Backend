import { Router } from 'express';
import {
  createUser,
  getUser,
  uploadCV,
  handleCVUpload,
  getSignupMetadata,
  getUserProfile,
  createUserProfile
} from '../controllers/user.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';

const router = Router();

// Legacy routes
router.get('/register/user', getSignupMetadata);
router.post('/', createUser);

// New profile routes (must be before /:userId to avoid conflicts)
router.get('/profile', getUserProfile);
router.post('/profile', uploadCV, createUserProfile);

// CV upload route
router.post('/:userId/cv', uploadCV, handleCVUpload);

// User routes (keep this last to avoid conflicts)
router.get('/:userId', getUser);

export default router;
