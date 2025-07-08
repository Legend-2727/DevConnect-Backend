import { describe, it, expect, jest, beforeEach, beforeAll } from '@jest/globals';

// ==================================================================
// MOCK EXTERNAL DEPENDENCIES
// ==================================================================
jest.unstable_mockModule('jsonwebtoken', () => ({
  default: {
    verify: jest.fn(),
  },
}));

jest.unstable_mockModule('../../db/index.js', () => ({
  default: {
    query: jest.fn(),
  },
}));

// ==================================================================
// DYNAMICALLY IMPORT MODULES
// ==================================================================
let companyController;
let db;
let jwt;

beforeAll(async () => {
  companyController = await import('../../controllers/company.controller.js');
  db = (await import('../../db/index.js')).default;
  jwt = (await import('jsonwebtoken')).default;
});

// ==================================================================
// TEST SUITE
// ==================================================================
describe('Company Controller', () => {
  let mockRequest;
  let mockResponse;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRequest = {
      cookies: {},
      body: {},
      params: {},
    };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
  });

  // Helper to set up a valid token and decoded user
  const setupAuth = (user = { id: 1, type: 'Company' }) => {
    mockRequest.cookies.token = 'valid-token';
    jwt.verify.mockReturnValue(user);
  };

  describe('getCompanyProfile', () => {
    it('should return a profile if token is valid and profile exists', async () => {
      setupAuth();
      const mockAccount = { id: 1, email: 'company@test.com', account_type: 'Company' };
      const mockProfile = { id: 10, name: 'Test Corp', account_id: 1, email: 'company@test.com' };
      db.query
        .mockResolvedValueOnce({ rows: [mockAccount] })
        .mockResolvedValueOnce({ rows: [mockProfile] });

      await companyController.getCompanyProfile(mockRequest, mockResponse);

      expect(mockResponse.json).toHaveBeenCalledWith({ success: true, profile: mockProfile });
    });

    it('should return 401 if account is not a Company', async () => {
        setupAuth(); // Sets up a 'Company' user by default
        const mockAccount = { id: 1, email: 'user@test.com', account_type: 'User' };
        db.query.mockResolvedValueOnce({ rows: [] }); // Simulate check failing
  
        await companyController.getCompanyProfile(mockRequest, mockResponse);
  
        expect(mockResponse.status).toHaveBeenCalledWith(401);
        expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Invalid account' });
      });

    it('should return 401 if no token is provided', async () => {
      await companyController.getCompanyProfile(mockRequest, mockResponse);
      expect(mockResponse.status).toHaveBeenCalledWith(401);
    });
  });

  describe('createCompanyProfile', () => {
    it('should create a new profile if one does not exist', async () => {
      setupAuth();
      mockRequest.body = { name: 'New Corp', industry: 'Tech' };
      const mockAccount = { email: 'new@corp.com' };
      const newProfile = { id: 1, account_id: 1, name: 'New Corp' };
      db.query
        .mockResolvedValueOnce({ rows: [mockAccount] })
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [newProfile] });

      await companyController.createCompanyProfile(mockRequest, mockResponse);

      expect(db.query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO'), expect.any(Array));
      expect(mockResponse.json).toHaveBeenCalledWith({ success: true, profile: newProfile });
    });

    it('should update an existing profile', async () => {
        setupAuth();
        mockRequest.body = { name: 'Updated Corp' };
        const mockAccount = { email: 'new@corp.com' };
        const updatedProfile = { id: 1, name: 'Updated Corp' };
        db.query
          .mockResolvedValueOnce({ rows: [mockAccount] })
          .mockResolvedValueOnce({ rows: [{id: 1}] })
          .mockResolvedValueOnce({ rows: [updatedProfile] });
  
        await companyController.createCompanyProfile(mockRequest, mockResponse);
  
        expect(db.query).toHaveBeenCalledWith(expect.stringContaining('UPDATE'), expect.any(Array));
        expect(mockResponse.json).toHaveBeenCalledWith({ success: true, profile: updatedProfile });
      });
  });

  describe('getCompanyJobs', () => {
    it('should return jobs for the authenticated company', async () => {
        setupAuth();
        mockRequest.params = { companyId: '10' };
        const companyProfile = { id: 10 };
        const jobs = [{id: 101, title: 'Job 1'}, {id: 102, title: 'Job 2'}];
        db.query
            .mockResolvedValueOnce({ rows: [companyProfile] }) // Find company
            .mockResolvedValueOnce({ rows: jobs }); // Get jobs
        
        await companyController.getCompanyJobs(mockRequest, mockResponse);

        expect(mockResponse.status).toHaveBeenCalledWith(200);
        expect(mockResponse.json).toHaveBeenCalledWith({ success: true, jobs: jobs });
    });

    it('should return 403 if requesting jobs for another company', async () => {
        setupAuth(); // Logged in as company with internal ID 10
        mockRequest.params = { companyId: '99' }; // Requesting jobs for company 99
        const companyProfile = { id: 10 };
        db.query.mockResolvedValueOnce({ rows: [companyProfile] });

        await companyController.getCompanyJobs(mockRequest, mockResponse);

        expect(mockResponse.status).toHaveBeenCalledWith(403);
        expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Access denied' });
    });
  });

  describe('createInterviewer', () => {
    it('should create an interviewer and return it', async () => {
        setupAuth();
        mockRequest.body = { name: 'Jane Doe', email: 'jane@corp.com', role: 'Manager' };
        const companyProfile = { id: 10 };
        const newInterviewer = { id: 5, name: 'Jane Doe' };
        db.query
            .mockResolvedValueOnce({ rows: [companyProfile] })
            .mockResolvedValueOnce({ rows: [newInterviewer] });

        await companyController.createInterviewer(mockRequest, mockResponse);

        expect(mockResponse.status).toHaveBeenCalledWith(201);
        expect(mockResponse.json).toHaveBeenCalledWith({ success: true, interviewer: newInterviewer });
    });

    it('should return 409 if interviewer email is a duplicate', async () => {
        setupAuth();
        mockRequest.body = { name: 'Jane Doe', email: 'jane@corp.com' };
        const companyProfile = { id: 10 };
        db.query
            .mockResolvedValueOnce({ rows: [companyProfile] })
            .mockRejectedValueOnce({ code: '23505' }); // Simulate unique constraint violation

        await companyController.createInterviewer(mockRequest, mockResponse);

        expect(mockResponse.status).toHaveBeenCalledWith(409);
        expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Interviewer with this email already exists for this company' });
    });
  });
});
