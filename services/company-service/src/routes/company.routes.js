import express from 'express';
import {
  createJob,
  getCompanyJobs,
  getJobApplications,
  getJobApplicationCount,
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
router.get('/jobs/:jobId/applications', getJobApplications);
router.get('/jobs/:jobId/applications/count', getJobApplicationCount);
router.post('/jobs/:jobId/shortlist', triggerShortlistAI);
router.post('/interviews/schedule', scheduleInterview);

export default router;
