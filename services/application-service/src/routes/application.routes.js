import express from 'express';
import {
  applyForJob,
  getUserApplications,
  getApplicationById,
  withdrawApplication,
  updateApplicationStatus,
  getJobDescription
} from '../controllers/application.controller.js';

const router = express.Router();

// Application routes
router.get('/jobs/:jobId', getJobDescription);
router.post('/jobs/:jobId/apply', applyForJob);
router.get('/my-applications', getUserApplications);
router.get('/applications/:applicationId', getApplicationById);
router.put('/applications/:applicationId/withdraw', withdrawApplication);
router.put('/applications/:applicationId/status', updateApplicationStatus);

export default router;
