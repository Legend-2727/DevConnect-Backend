import { describe, it, expect, jest, beforeEach, beforeAll } from '@jest/globals';

// ==================================================================
// MOCK EXTERNAL DEPENDENCIES
// ==================================================================
jest.unstable_mockModule('axios', () => ({
  default: {
    post: jest.fn(),
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
let aiController;
let db;
let axios;

beforeAll(async () => {
  aiController = await import('../../controllers/ai.controller.js');
  db = (await import('../../db/index.js')).default;
  axios = (await import('axios')).default;
});

// ==================================================================
// TEST SUITE
// ==================================================================
describe('AI Controller', () => {
  let mockRequest;
  let mockResponse;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRequest = {
      params: { companyId: '1', jobId: '10' },
    };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
  });

  describe('shortlistApplicants', () => {
    it('should call AI service and update DB on success', async () => {
      // Arrange
      const mockJob = { id: 10, title: 'Engineer' };
      db.query
        .mockResolvedValueOnce({ rows: [mockJob] }) // Find job
        .mockResolvedValueOnce({}); // Update applications status

      const mockAiResponse = {
        data: {
          job_title: 'Engineer',
          total_applicants: 5,
          shortlisted_count: 2,
          email_sent: true,
          shortlist: [{ user_id: 101 }, { user_id: 102 }],
        },
      };
      axios.post.mockResolvedValue(mockAiResponse);

      // Act
      await aiController.shortlistApplicants(mockRequest, mockResponse);

      // Assert
      expect(axios.post).toHaveBeenCalledWith(expect.stringContaining('/shortlist'), { job_id: 10 }, expect.any(Object));
      expect(db.query).toHaveBeenCalledWith(expect.stringContaining('UPDATE devconnect.applications'), [ '10', [101, 102] ]);
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, shortlisted_count: 2 }));
    });

    it('should return 404 if job is not found', async () => {
      // Arrange
      db.query.mockResolvedValue({ rows: [] }); // No job found

      // Act
      await aiController.shortlistApplicants(mockRequest, mockResponse);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Job not found' });
      expect(axios.post).not.toHaveBeenCalled();
    });

    it('should return 502 if AI service fails', async () => {
      // Arrange
      const mockJob = { id: 10, title: 'Engineer' };
      db.query.mockResolvedValue({ rows: [mockJob] }); // Find job
      axios.post.mockRejectedValue(new Error('AI service down')); // AI service call fails

      // Act
      await aiController.shortlistApplicants(mockRequest, mockResponse);

      // Assert
      expect(mockResponse.status).toHaveBeenCalledWith(502);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'AI service unavailable or timed out' });
    });
  });
});
