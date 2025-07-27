import { describe, it, expect, jest, beforeEach, beforeAll } from '@jest/globals';
import request from 'supertest';
import express from 'express';

// Mock the controller functions
const mockController = {
  applyForJob: jest.fn(),
  getUserApplications: jest.fn(),
  getApplicationById: jest.fn(),
  withdrawApplication: jest.fn(),
  updateApplicationStatus: jest.fn()
};

// Mock the controller module
jest.unstable_mockModule('../../controllers/application.controller.js', () => mockController);

// Test suite
describe('Application Routes', () => {
  let app;
  let applicationRoutes;

  beforeAll(async () => {
    // Dynamically import the routes module after mocking dependencies
    applicationRoutes = (await import('../../routes/application.routes.js')).default;
    
    // Create an express app and use the routes
    app = express();
    app.use(express.json());
    app.use('/', applicationRoutes);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /jobs/:jobId/apply', () => {
    it('should route to applyForJob controller', async () => {
      await request(app).post('/jobs/123/apply');
      expect(mockController.applyForJob).toHaveBeenCalledTimes(1);
    });
  });

  describe('GET /my-applications', () => {
    it('should route to getUserApplications controller', async () => {
      await request(app).get('/my-applications');
      expect(mockController.getUserApplications).toHaveBeenCalledTimes(1);
    });
  });

  describe('GET /applications/:applicationId', () => {
    it('should route to getApplicationById controller', async () => {
      await request(app).get('/applications/42');
      expect(mockController.getApplicationById).toHaveBeenCalledTimes(1);
    });
  });

  describe('PUT /applications/:applicationId/withdraw', () => {
    it('should route to withdrawApplication controller', async () => {
      await request(app).put('/applications/42/withdraw');
      expect(mockController.withdrawApplication).toHaveBeenCalledTimes(1);
    });
  });

  describe('PUT /applications/:applicationId/status', () => {
    it('should route to updateApplicationStatus controller', async () => {
      await request(app).put('/applications/42/status')
        .send({ status: 'SHORTLISTED' });
      expect(mockController.updateApplicationStatus).toHaveBeenCalledTimes(1);
    });
  });
});
