// import express from 'express';
// import { runShortlistAI } from '../controllers/ai.controller.js';

// const router = express.Router();
// router.post('/shortlist/:jobId', runShortlistAI);
// export default router;
// import { Router } from "express";
// import { shortlistApplicants } from "../controllers/ai.controller.js";

// const router = Router();

// // POST /companies/:companyId/jobs/:jobId/shortlist
// router.post(
//   "/companies/:companyId/jobs/:jobId/shortlist",
//   shortlistApplicants
// );

// export default router;


import { Router } from "express";
import { shortlistApplicants } from "../controllers/ai.controller.js";
import { validateIds, verifyCompanyOwnership } from "../middlewares/validation.js";

const router = Router();

router.post(
  "/companies/:companyId/jobs/:jobId/shortlist",
  // validateIds, // Validate ID formats
  // verifyCompanyOwnership, // Verify company owns the job
  shortlistApplicants
);

export default router;
