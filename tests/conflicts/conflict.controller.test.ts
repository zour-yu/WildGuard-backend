/**
 * Unit Test Suite: ConflictController (UC-03: Manage Human-Wildlife Conflict)
 * Member 2: Human-Wildlife Conflict Incident Management
 */

import { Request, Response } from 'express';
import {
  getConflicts,
  mockSms,
  submitAppReport,
  updateConflictStatus,
} from '../../src/controllers/conflict.controller';

// Mock Socket.io alerts module
jest.mock('../../src/sockets/alert.socket', () => ({
  getSocketServer: jest.fn().mockReturnValue({
    emit: jest.fn(),
  }),
}));

// Mock Cloudinary for image attachments
jest.mock('../../src/config/cloudinary.config', () => ({
  __esModule: true,
  default: {
    uploader: {
      upload: jest.fn().mockResolvedValue({ secure_url: 'https://cloudinary.com/test-img.jpg' }),
    },
  },
}));

describe('ConflictController (UC-03: Manage Human-Wildlife Conflict)', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  beforeEach(() => {
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock });

    mockRes = {
      status: statusMock,
      json: jsonMock,
    };
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ==========================================
  // Test Case 1: Positive - Retrieve Conflicts
  // ==========================================
  describe('Test Case 1: getConflicts (Positive)', () => {
    it('should return 200 and a list of conflict incidents', async () => {
      mockReq = {};

      await getConflicts(mockReq as Request, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith(expect.any(Array));
      const returnedData = jsonMock.mock.calls[0][0];
      expect(returnedData.length).toBeGreaterThan(0);
      expect(returnedData[0]).toHaveProperty('priority');
      expect(returnedData[0]).toHaveProperty('location');
    });
  });

  // ==========================================
  // Test Case 2: Positive - Process & Prioritize SMS Alert
  // ==========================================
  describe('Test Case 2: mockSms (Positive & Priority Classification)', () => {
    it('should successfully record SMS alert with HIGH priority when danger keywords are detected', async () => {
      mockReq = {
        body: {
          body: 'Emergency: aggressive elephant attack reported near farm fence!',
          from: '+94771122334',
        },
      };

      await mockSms(mockReq as Request, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(201);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Mock SMS processed and broadcasted',
          conflict: expect.objectContaining({
            source: 'SMS',
            priority: 'HIGH',
            reporter: '+94771122334',
          }),
        })
      );
    });

    it('should record SMS alert with MEDIUM priority for general sightings', async () => {
      mockReq = {
        body: {
          body: 'Elephant herd spotted crossing near the canal border',
          from: '+94775566778',
        },
      };

      await mockSms(mockReq as Request, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(201);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          conflict: expect.objectContaining({
            priority: 'MEDIUM',
          }),
        })
      );
    });
  });

  // ==========================================
  // Test Case 3: State Transition & Negative Validation
  // ==========================================
  describe('Test Case 3: updateConflictStatus (State Transition & Error Handling)', () => {
    it('should successfully transition conflict status to RESOLVED and set resolved timestamp', async () => {
      mockReq = {
        params: { id: 'conf-mock-001' },
        body: {
          status: 'RESOLVED',
          notes: 'Deterrence patrol successfully guided elephants back into reserve.',
        },
      };

      await updateConflictStatus(mockReq as Request, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          conflict: expect.objectContaining({
            _id: 'conf-mock-001',
            status: 'RESOLVED',
            resolvedAt: expect.any(String),
          }),
        })
      );
    });

    it('should return 404 when attempting to update a non-existent conflict ID', async () => {
      mockReq = {
        params: { id: 'conf-non-existent-99999' },
        body: {
          status: 'IN_PROGRESS',
        },
      };

      await updateConflictStatus(mockReq as Request, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(404);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Conflict not found',
        })
      );
    });
  });

  // ==========================================
  // Test Case 4: Conflict Reporting (submitAppReport)
  // ==========================================
  describe('Test Case 4: submitAppReport (Conflict Reporting)', () => {
    it('should successfully submit an app conflict report with text and location', async () => {
      mockReq = {
        body: {
          category: 'Crop Damage',
          name: 'Sunil Perera',
          phone: '+94712345678',
          location: 'Sector 4: Farmland 8A Buffer',
          description: 'Elephant broke through the fence and damaged corn crops.',
        },
      };

      await submitAppReport(mockReq as Request, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(201);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          conflict: expect.objectContaining({
            source: 'App',
            reporter: 'Sunil Perera (+94712345678)',
            location: 'Sector 4: Farmland 8A Buffer',
          }),
        })
      );
    });

    it('should handle conflict report with photo attachment upload', async () => {
      mockReq = {
        body: {
          category: 'Aggressive Encounter',
          reporter: 'Ranger Station 2',
          description: 'Emergency attack warning: rogue bull charging near trail',
        },
        file: {
          buffer: Buffer.from('fake-image-bytes'),
          mimetype: 'image/jpeg',
        } as Express.Multer.File,
      };

      await submitAppReport(mockReq as Request, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(201);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          conflict: expect.objectContaining({
            source: 'App',
            priority: 'HIGH',
            imageUrl: 'https://cloudinary.com/test-img.jpg',
          }),
        })
      );
    });

    it('should return 500 when report processing encounters an error', async () => {
      mockReq = {
        get body() {
          throw new Error('Simulated payload error');
        },
      };

      await submitAppReport(mockReq as Request, mockRes as Response);

      expect(statusMock).toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Error processing app report',
        })
      );
    });
  });
});
