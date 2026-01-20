import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Repository } from 'typeorm';
import { FilesService } from './files.service';
import { File } from './entities/file.entity';

describe('FilesService', () => {
  let service: FilesService;
  let fileRepository: Repository<File>;

  const mockFileRepository = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
    find: jest.fn(),
    remove: jest.fn(),
    manager: {
      createQueryBuilder: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        from: jest.fn().mockReturnThis(),
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawOne: jest.fn(),
      }),
      query: jest.fn(),
    },
  };

  const mockConfigService = {
    get: jest.fn().mockReturnValue('/tmp/test-uploads'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FilesService,
        {
          provide: getRepositoryToken(File),
          useValue: mockFileRepository,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<FilesService>(FilesService);
    fileRepository = module.get<Repository<File>>(getRepositoryToken(File));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('validateFile', () => {
    it('should validate a valid PDF file', async () => {
      const mockFile: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'resume.pdf',
        encoding: '7bit',
        mimetype: 'application/pdf',
        size: 1024 * 1024, // 1MB
        buffer: Buffer.from('%PDF-1.4'),
        destination: '',
        filename: '',
        path: '',
        stream: null,
      };

      const result = await service.validateFile(mockFile);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject files that are too large', async () => {
      const mockFile: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'large-resume.pdf',
        encoding: '7bit',
        mimetype: 'application/pdf',
        size: 6 * 1024 * 1024, // 6MB (exceeds 5MB limit)
        buffer: Buffer.from('%PDF-1.4'),
        destination: '',
        filename: '',
        path: '',
        stream: null,
      };

      const result = await service.validateFile(mockFile);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('File size exceeds maximum limit of 5MB');
    });

    it('should reject invalid file types', async () => {
      const mockFile: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'resume.txt',
        encoding: '7bit',
        mimetype: 'text/plain',
        size: 1024,
        buffer: Buffer.from('This is a text file'),
        destination: '',
        filename: '',
        path: '',
        stream: null,
      };

      const result = await service.validateFile(mockFile);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('File type not allowed. Only PDF and Word documents are accepted');
    });

    it('should reject files with path traversal in filename', async () => {
      const mockFile: Express.Multer.File = {
        fieldname: 'file',
        originalname: '../../../etc/passwd.pdf',
        encoding: '7bit',
        mimetype: 'application/pdf',
        size: 1024,
        buffer: Buffer.from('%PDF-1.4'),
        destination: '',
        filename: '',
        path: '',
        stream: null,
      };

      const result = await service.validateFile(mockFile);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Invalid filename detected');
    });
  });
});