import { Router } from 'express';
import {
  createUser,
  getUser,
  updateUser,
  uploadCV,
  getSignupMetadata
} from '../controllers/user.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';
import { upload } from '../middlewares/upload.middleware.js';


const router = Router();

router.get('/register/user', getSignupMetadata);
router.post('/', createUser);
router.get('/:userId', authenticate, getUser);
router.put('/:userId', authenticate, updateUser);
// router.post('/:userId/cv', authenticate, upload.single('cv'), uploadCV);
router.post('/:userId/cv', /* authenticate, */ upload.single('cv'), uploadCV);


export default router;
