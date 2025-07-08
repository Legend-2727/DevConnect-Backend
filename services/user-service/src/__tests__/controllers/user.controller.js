import { describe, it, expect, jest, beforeEach, beforeAll } from '@jest/globals';

// ==================================================================
// MOCK EXTERNAL DEPENDENCIES
// ==================================================================
jest.unstable_mockModule('jsonwebtoken', () => ({
  default: {
    verify: jest.fn(),
  },
}));

jest.unstable_mockModule('../../db.js', () => ({
  default: {
    query: jest.fn(),
  },
}));

jest.unstable_mockModule('fs', () => ({
  default: {
    existsSync: jest.fn(),
    mkdirSync: jest.fn(),
  },
}));

// ==================================================================
// DYNAMICALLY IMPORT MODULES
// ==================================================================
let userController;
let db;
let jwt;
let fs;

beforeAll(async () => {
  userController = await import('../../controllers/user.controller.js');
  db = (await import('../../db.js')).default;
  jwt = (await import('jsonwebtoken')).default;
  fs = (await import('fs')).default;
});

// ==================================================================
// TEST SUITE
// ==================================================================
describe('User Controller', () => {
  let mockRequest;
  let mockResponse;

  beforeEach(() => {
    jest.clearAllMocks();
    fs.existsSync.mockReturnValue(true);

    mockRequest = {
      cookies: {},
      body: {},
      params: {},
      file: null,
    };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
  });

  const setupAuth = (user = { id: 1, type: 'User' }) => {
    mockRequest.cookies.token = 'valid-token';
    jwt.verify.mockReturnValue(user);
  };

  // NEW: Test for getSignupMetadata
  describe('getSignupMetadata', () => {
    it('should return metadata for signup options', () => {
      userController.getSignupMetadata(mockRequest, mockResponse);
      expect(mockResponse.json).toHaveBeenCalledWith({
        educationLevels: expect.any(Array),
        experienceLevels: expect.any(Array),
        preferredRoles: expect.any(Array),
      });
    });
  });

  // NEW: Test for the legacy createUser
  describe('createUser', () => {
    it('should insert a new user and return the new user ID', async () => {
        mockRequest.body = { name: 'Legacy User', email: 'legacy@test.com', accountId: 99 };
        db.query.mockResolvedValue({ rows: [{ id: 150 }] });

        await userController.createUser(mockRequest, mockResponse);

        expect(db.query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO devconnect.users'), [99, 'Legacy User', 'legacy@test.com']);
        expect(mockResponse.status).toHaveBeenCalledWith(201);
        expect(mockResponse.json).toHaveBeenCalledWith({ userId: 150 });
    });
  });

  describe('getUserProfile', () => {
    it('should return a user profile if one exists', async () => {
      setupAuth();
      const mockProfile = { account_id: 1, name: 'John Doe', cv_url: '/uploads/cvs/cv.pdf' };
      db.query.mockResolvedValue({ rows: [mockProfile] });

      await userController.getUserProfile(mockRequest, mockResponse);

      expect(mockResponse.json).toHaveBeenCalledWith({
        profile: expect.objectContaining({
          name: 'John Doe',
          cv_url: expect.stringContaining('http://localhost:4004/uploads/cvs/cv.pdf'),
        }),
      });
    });

    it('should return null if no profile exists', async () => {
      setupAuth();
      db.query.mockResolvedValue({ rows: [] });
      await userController.getUserProfile(mockRequest, mockResponse);
      expect(mockResponse.json).toHaveBeenCalledWith({ profile: null });
    });

    // RE-ADDED: Test for missing token
    it('should return 401 if no token is provided', async () => {
      await userController.getUserProfile(mockRequest, mockResponse);
      expect(mockResponse.status).toHaveBeenCalledWith(401);
    });
  });

  describe('createUserProfile', () => {
    it('should create a new profile if one does not exist', async () => {
      setupAuth();
      mockRequest.body = { name: 'Jane Doe' };
      const newProfile = { account_id: 1, name: 'Jane Doe' };
      
      db.query
        .mockResolvedValueOnce({ rows: [] })
        .mockResolvedValueOnce({ rows: [newProfile] })
        .mockResolvedValueOnce({ rows: [{ email: 'jane@doe.com' }] });

      await userController.createUserProfile(mockRequest, mockResponse);
      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        profile: expect.objectContaining({ name: 'Jane Doe' }),
      });
    });

    it('should update an existing profile, including CV if provided', async () => {
        setupAuth();
        mockRequest.body = { name: 'Jane Doe Updated' };
        mockRequest.file = { filename: 'new-cv.pdf' };
        const updatedProfile = { account_id: 1, name: 'Jane Doe Updated' };
        
        db.query
          .mockResolvedValueOnce({ rows: [{ id: 1 }] })
          .mockResolvedValueOnce({ rows: [updatedProfile] })
          .mockResolvedValueOnce({ rows: [{ email: 'jane@doe.com' }] });
  
        await userController.createUserProfile(mockRequest, mockResponse);
  
        const updateQueryCall = db.query.mock.calls.find(call => call[0].includes('UPDATE'));
        expect(updateQueryCall[0]).toContain('cv_url');
        expect(updateQueryCall[1]).toEqual(expect.arrayContaining([expect.stringContaining('new-cv.pdf')]));
        expect(mockResponse.json).toHaveBeenCalledWith({
          success: true,
          profile: expect.objectContaining({ name: 'Jane Doe Updated' }),
        });
      });
  });

  describe('handleCVUpload', () => {
    it('should update user with CV URL on successful upload', async () => {
        setupAuth();
        mockRequest.params = { userId: '1' };
        mockRequest.file = { filename: 'cv-123.pdf' };
        db.query.mockResolvedValueOnce({});

        await userController.handleCVUpload(mockRequest, mockResponse);
        
        expect(mockResponse.json).toHaveBeenCalledWith({
            success: true,
            cv_url: '/uploads/cvs/cv-123.pdf',
            message: 'CV uploaded successfully'
        });
    });

    // RE-ADDED: Test for missing file
    it('should return 400 if no file is uploaded', async () => {
        setupAuth();
        await userController.handleCVUpload(mockRequest, mockResponse);
        expect(mockResponse.status).toHaveBeenCalledWith(400);
    });
  });
});
