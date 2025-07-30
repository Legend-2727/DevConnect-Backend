import { describe, it, expect, jest } from '@jest/globals';
import { isValidStatus, validateApplicationStatusUpdate } from '../../utils/validation.js';

// ==================================================================
// TEST SUITE
// ==================================================================
describe('Validation Utilities', () => {
  
  describe('isValidStatus', () => {
    it('should return true for valid status values', () => {
      // Test all valid statuses
      expect(isValidStatus('UNDER_REVIEW')).toBe(true);
      expect(isValidStatus('SHORTLISTED')).toBe(true);
      expect(isValidStatus('ACCEPTED')).toBe(true);
      expect(isValidStatus('REJECTED')).toBe(true);
      expect(isValidStatus('INTERVIEW')).toBe(true);
      expect(isValidStatus('WITHDRAWN')).toBe(true);
    });

    it('should return false for invalid status values', () => {
      expect(isValidStatus('PENDING')).toBe(false);
      expect(isValidStatus('INVALID_STATUS')).toBe(false);
      expect(isValidStatus('')).toBe(false);
      expect(isValidStatus(null)).toBe(false);
      expect(isValidStatus(undefined)).toBe(false);
      expect(isValidStatus(123)).toBe(false);
    });

    it('should be case sensitive', () => {
      expect(isValidStatus('under_review')).toBe(false);
      expect(isValidStatus('UNDER_review')).toBe(false);
    });
  });

  describe('validateApplicationStatusUpdate', () => {
    let mockRequest;
    let mockResponse;
    let nextFunction;

    beforeEach(() => {
      mockRequest = {
        body: {}
      };
      mockResponse = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn()
      };
      nextFunction = jest.fn();
    });

    it('should call next() if status is valid', () => {
      mockRequest.body.status = 'SHORTLISTED';
      
      validateApplicationStatusUpdate(mockRequest, mockResponse, nextFunction);
      
      expect(nextFunction).toHaveBeenCalledTimes(1);
      expect(mockResponse.status).not.toHaveBeenCalled();
    });

    it('should return 400 if status is missing', () => {
      validateApplicationStatusUpdate(mockRequest, mockResponse, nextFunction);
      
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Status is required' });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should return 400 with valid values if status is invalid', () => {
      mockRequest.body.status = 'INVALID_STATUS';
      
      validateApplicationStatusUpdate(mockRequest, mockResponse, nextFunction);
      
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Invalid status value',
        validValues: expect.arrayContaining(['UNDER_REVIEW', 'SHORTLISTED', 'ACCEPTED', 'REJECTED', 'INTERVIEW', 'WITHDRAWN'])
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it('should validate all valid statuses correctly', () => {
      const validStatuses = [
        'UNDER_REVIEW',
        'SHORTLISTED',
        'ACCEPTED',
        'REJECTED',
        'INTERVIEW',
        'WITHDRAWN'
      ];
      
      validStatuses.forEach(status => {
        mockRequest.body.status = status;
        validateApplicationStatusUpdate(mockRequest, mockResponse, nextFunction);
      });
      
      expect(nextFunction).toHaveBeenCalledTimes(validStatuses.length);
    });
  });
});
