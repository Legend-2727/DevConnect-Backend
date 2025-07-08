import { describe, it, expect, jest, beforeEach, beforeAll } from '@jest/globals';

// ==================================================================
// MOCK EXTERNAL DEPENDENCIES
// ==================================================================
jest.unstable_mockModule('../../db/index.js', () => ({
  default: {
    query: jest.fn(),
  },
}));

// ==================================================================
// DYNAMICALLY IMPORT MODULES
// ==================================================================
let validationMiddleware;
let db;

beforeAll(async () => {
    validationMiddleware = await import('../../middlewares/validation.js');
    db = (await import('../../db/index.js')).default;
});

// ==================================================================
// TEST SUITE
// ==================================================================
describe('Validation Middleware', () => {
    let mockRequest;
    let mockResponse;
    let nextFunction;
  
    beforeEach(() => {
      jest.clearAllMocks();
      mockRequest = { params: {} };
      mockResponse = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };
      nextFunction = jest.fn();
    });

    describe('validateIds', () => {
        it('should call next() if IDs are valid integers', () => {
            mockRequest.params = { companyId: '1', jobId: '10' };
            validationMiddleware.validateIds(mockRequest, mockResponse, nextFunction);
            expect(nextFunction).toHaveBeenCalledTimes(1);
        });

        it('should return 400 if companyId is not a valid integer', () => {
            mockRequest.params = { companyId: 'abc', jobId: '10' };
            validationMiddleware.validateIds(mockRequest, mockResponse, nextFunction);
            expect(mockResponse.status).toHaveBeenCalledWith(400);
            expect(nextFunction).not.toHaveBeenCalled();
        });
    });

    describe('verifyCompanyOwnership', () => {
        it('should call next() if company owns the job', async () => {
            mockRequest.params = { companyId: 1, jobId: 10 };
            db.query.mockResolvedValue({ rows: [{ id: 1 }] }); // Ownership verified
            await validationMiddleware.verifyCompanyOwnership(mockRequest, mockResponse, nextFunction);
            expect(nextFunction).toHaveBeenCalledTimes(1);
        });

        it('should return 403 if company does not own the job', async () => {
            mockRequest.params = { companyId: 1, jobId: 10 };
            db.query.mockResolvedValue({ rows: [] }); // Ownership check fails
            await validationMiddleware.verifyCompanyOwnership(mockRequest, mockResponse, nextFunction);
            expect(mockResponse.status).toHaveBeenCalledWith(403);
            expect(nextFunction).not.toHaveBeenCalled();
        });
    });
});
