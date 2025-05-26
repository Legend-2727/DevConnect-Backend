import { Router } from 'express';
import {
  registerAccount,
  loginOptions,
  logoutUser,
  validateLogin,
  getLoggedInUser 
} from '../controllers/auth.controller.js';

import { authenticate } from '../middlewares/auth.middleware.js';

const router = Router();


router.get('/login', loginOptions);


router.post('/login/validate', validateLogin);


router.post('/logout', logoutUser);


router.get('/me', authenticate, getLoggedInUser);

router.post('/register', registerAccount);

export default router;
