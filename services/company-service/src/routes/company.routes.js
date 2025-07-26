import express from 'express';
import {
  createJob,
  getCompanyJobs,
  triggerShortlistAI,
  scheduleInterview,
  getCompanyProfile,
  createCompanyProfile,
  uploadLogo,
  logoUpload,
  debugCurrentUser,
  createInterviewer,
  getCompanyInterviewers,
  assignInterviewersToJob,
  getJobInterviewers,
  getJobApplications,
  getJobDetails,
  bulkUpdateApplicationStatus
} from '../controllers/company.controller.js';

const router = express.Router();

// Debug routes
router.get('/debug', debugCurrentUser);

// Profile routes
router.get('/profile', getCompanyProfile);
router.post('/profile', logoUpload, createCompanyProfile);
router.post('/upload-logo', logoUpload, uploadLogo);

// Job routes
router.post('/jobs', createJob);
router.get('/jobs/:companyId', getCompanyJobs);
router.get('/jobs/:jobId/applications', getJobApplications);
router.put('/jobs/:jobId/applications/bulk-update', bulkUpdateApplicationStatus);
router.post('/jobs/:jobId/shortlist', triggerShortlistAI);
router.post('/interviews/schedule', scheduleInterview);

// Interviewer routes
router.post('/interviewers', createInterviewer);
router.get('/interviewers', getCompanyInterviewers);
router.post('/jobs/:jobId/interviewers', assignInterviewersToJob);
router.get('/jobs/:jobId/interviewers', getJobInterviewers);
router.get('/jobs/:jobId', getJobDetails);

export default router;
