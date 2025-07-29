import express from 'express';
import {
  applyForJob,
  getUserApplications,
  getApplicationById,
  withdrawApplication,
  updateApplicationStatus,
  getJobDescription,
  getCompanyProfile,
  getLatestJobs
} from '../controllers/application.controller.js';

const router = express.Router();

// Application routes
router.get('/company/:companyId', getCompanyProfile); // not using this anymore
router.get('/jobs/:jobId', getJobDescription);
router.get('/jobs', getLatestJobs);
router.post('/jobs/:jobId/apply', applyForJob);
router.get('/my-applications', getUserApplications);
router.get('/applications/:applicationId', getApplicationById);
router.put('/applications/:applicationId/withdraw', withdrawApplication);
router.put('/applications/:applicationId/status', updateApplicationStatus);

export default router;
