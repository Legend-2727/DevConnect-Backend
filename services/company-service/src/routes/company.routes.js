import express from 'express';
import {
  createJob,
  getCompanyJobs,
  triggerShortlistAI,
  scheduleInterview
} from '../controllers/company.controller.js';

const router = express.Router();

router.post('/jobs', createJob);
router.get('/jobs/:companyId', getCompanyJobs);
router.post('/jobs/:jobId/shortlist', triggerShortlistAI);
router.post('/interviews/schedule', scheduleInterview);

export default router;
