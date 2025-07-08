import { describe, it, expect, jest } from '@jest/globals';
import { loginOptions } from '../../controllers/auth.controller.js';

describe('Auth Controller', () => {
  describe('loginOptions', () => {
    it('should return available account types', () => {
      // Arrange: Create mock request and response objects
      const req = {};
      const res = {
        json: jest.fn()
      };

      // Act: Call the controller function
      loginOptions(req, res);

      // Assert: Check that res.json was called with the expected data
      expect(res.json).toHaveBeenCalledTimes(1);
      expect(res.json).toHaveBeenCalledWith({ 
        accountTypes: ["User", "Company"] 
      });
    });
  });
});
