import express from 'express';
import {
  createJob,
  getCompanyJobs,
  triggerShortlistAI,
  scheduleInterview,
  browseJobs,
  testDB
} from '../controllers/company.controller.js';

const router = express.Router();

router.get('/test', testDB);
router.post('/jobs', createJob);
router.get('/jobs/browse', browseJobs);
router.get('/jobs/:companyId', getCompanyJobs);
router.post('/jobs/:jobId/shortlist', triggerShortlistAI);
router.post('/interviews/schedule', scheduleInterview);

export default router;
