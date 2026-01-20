import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { File } from './entities/file.entity';
import { FileUploadResponseDto, FileValidationResultDto } from './dto';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class FilesService {
  private readonly uploadPath: string;
  private readonly maxFileSize = 5 * 1024 * 1024; // 5MB
  private readonly allowedMimeTypes = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword',
  ];

  constructor(
    @InjectRepository(File)
    private readonly fileRepository: Repository<File>,
    private readonly configService: ConfigService,
  ) {
    // Use environment variable or default to uploads directory
    this.uploadPath = this.configService.get<string>('UPLOAD_PATH') || 
      path.join(process.cwd(), 'uploads');
    this.ensureUploadDirectory();
  }

  private async ensureUploadDirectory(): Promise<void> {
    try {
      await fs.access(this.uploadPath);
    } catch {
      await fs.mkdir(this.uploadPath, { recursive: true });
    }
  }

  async validateFile(file: Express.Multer.File): Promise<FileValidationResultDto> {
    const errors: string[] = [];

    // Check file size
    if (file.size > this.maxFileSize) {
      errors.push(`File size exceeds maximum limit of ${this.maxFileSize / (1024 * 1024)}MB`);
    }

    // Check MIME type
    if (!this.allowedMimeTypes.includes(file.mimetype)) {
      errors.push('File type not allowed. Only PDF and Word documents are accepted');
    }

    // Check file extension
    const allowedExtensions = ['.pdf', '.doc', '.docx'];
    const fileExtension = path.extname(file.originalname).toLowerCase();
    if (!allowedExtensions.includes(fileExtension)) {
      errors.push('File extension not allowed. Only .pdf, .doc, and .docx files are accepted');
    }

    // Validate filename for security (prevent path traversal)
    if (this.containsPathTraversal(file.originalname)) {
      errors.push('Invalid filename detected');
    }

    // Basic malware check - scan for suspicious patterns
    if (await this.containsSuspiciousContent(file.buffer)) {
      errors.push('File contains suspicious content and cannot be uploaded');
    }

    // Additional file structure validation
    if (!await this.validateFileStructure(file)) {
      errors.push('File structure validation failed');
    }

    return new FileValidationResultDto(errors.length === 0, errors);
  }

  private containsPathTraversal(filename: string): boolean {
    const dangerousPatterns = [
      /\.\./,
      /\//,
      /\\/,
      /:/,
      /\*/,
      /\?/,
      /"/,
      /</,
      />/,
      /\|/,
    ];
    
    return dangerousPatterns.some(pattern => pattern.test(filename));
  }

  private async validateFileStructure(file: Express.Multer.File): Promise<boolean> {
    try {
      // Basic file header validation
      const buffer = file.buffer;
      
      if (file.mimetype === 'application/pdf') {
        // PDF files should start with %PDF
        return buffer.subarray(0, 4).toString() === '%PDF';
      }
      
      if (file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        // DOCX files are ZIP archives, should start with PK
        return buffer.subarray(0, 2).toString() === 'PK';
      }
      
      if (file.mimetype === 'application/msword') {
        // DOC files have specific header patterns
        const header = buffer.subarray(0, 8);
        return header.includes(Buffer.from([0xD0, 0xCF, 0x11, 0xE0])); // OLE header
      }
      
      return true;
    } catch {
      return false;
    }
  }

  private async containsSuspiciousContent(buffer: Buffer): Promise<boolean> {
    // Basic malware detection - check for suspicious patterns
    const suspiciousPatterns = [
      /eval\s*\(/gi,
      /javascript:/gi,
      /<script/gi,
      /vbscript:/gi,
      /onload\s*=/gi,
      /onerror\s*=/gi,
      /document\.write/gi,
      /window\.location/gi,
      /\.exe\s/gi,
      /\.bat\s/gi,
      /\.cmd\s/gi,
      /\.scr\s/gi,
      /\.pif\s/gi,
    ];

    // Check both UTF-8 and binary content for patterns
    const textContent = buffer.toString('utf8', 0, Math.min(buffer.length, 2048));
    const binaryContent = buffer.toString('binary', 0, Math.min(buffer.length, 2048));
    
    // Check for suspicious patterns in text content
    const hasTextThreats = suspiciousPatterns.some(pattern => pattern.test(textContent));
    
    // Check for suspicious patterns in binary content
    const hasBinaryThreats = suspiciousPatterns.some(pattern => pattern.test(binaryContent));
    
    // Check for embedded executables (basic check for PE header)
    const hasPEHeader = buffer.includes(Buffer.from('MZ')) && buffer.includes(Buffer.from('PE'));
    
    return hasTextThreats || hasBinaryThreats || hasPEHeader;
  }

  async uploadResume(
    userId: string,
    file: Express.Multer.File,
  ): Promise<FileUploadResponseDto> {
    // Validate file
    const validation = await this.validateFile(file);
    if (!validation.isValid) {
      throw new BadRequestException(validation.errors.join(', '));
    }

    // Generate UUID filename to prevent conflicts and path traversal
    const fileExtension = path.extname(file.originalname);
    const storedName = `${crypto.randomUUID()}${fileExtension}`;
    const storagePath = path.join(this.uploadPath, storedName);

    try {
      // Delete existing resume if user has one
      await this.deleteExistingResume(userId);

      // Save file to disk
      await fs.writeFile(storagePath, file.buffer);

      // Save file metadata to database
      const fileEntity = this.fileRepository.create({
        originalName: file.originalname,
        storedName,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        ownerId: userId,
        storagePath,
      });

      const savedFile = await this.fileRepository.save(fileEntity);

      // Log successful file upload
      await this.logSecurityEvent('FILE_UPLOAD', userId, savedFile.id);

      return {
        fileId: savedFile.id,
        originalName: savedFile.originalName,
        size: savedFile.sizeBytes,
        mimeType: savedFile.mimeType,
        uploadedAt: savedFile.createdAt,
      };
    } catch (error) {
      // Clean up file if database save fails
      try {
        await fs.unlink(storagePath);
      } catch {
        // Ignore cleanup errors
      }
      
      if (error instanceof BadRequestException) {
        throw error;
      }
      
      throw new InternalServerErrorException('Failed to upload file');
    }
  }

  private async deleteExistingResume(userId: string): Promise<void> {
    const existingFiles = await this.fileRepository.find({
      where: { ownerId: userId },
    });

    for (const file of existingFiles) {
      try {
        await fs.unlink(file.storagePath);
      } catch {
        // Ignore file system errors for cleanup
      }
      await this.fileRepository.remove(file);
    }
  }

  async getFileById(fileId: string): Promise<File> {
    const file = await this.fileRepository.findOne({
      where: { id: fileId },
      relations: ['owner'],
    });

    if (!file) {
      throw new NotFoundException('File not found');
    }

    return file;
  }

  async getResumeUrl(fileId: string, requesterId: string): Promise<string> {
    const file = await this.getFileById(fileId);

    // Check if requester has permission to access the file
    if (!await this.hasFileAccess(file, requesterId)) {
      throw new ForbiddenException('Access denied to this file');
    }

    return file.storagePath;
  }

  private async hasFileAccess(file: File, requesterId: string): Promise<boolean> {
    // Owner always has access
    if (file.ownerId === requesterId) {
      return true;
    }

    // Check if requester is a company that has received an application from the file owner
    const applicationExists = await this.fileRepository.manager
      .createQueryBuilder()
      .select('1')
      .from('applications', 'app')
      .innerJoin('jobs', 'job', 'job.id = app.job_id')
      .where('app.job_seeker_id = :fileOwnerId', { fileOwnerId: file.ownerId })
      .andWhere('job.company_id = :requesterId', { requesterId })
      .getRawOne();

    return !!applicationExists;
  }

  async deleteResume(fileId: string, ownerId: string): Promise<void> {
    const file = await this.fileRepository.findOne({
      where: { id: fileId, ownerId },
    });

    if (!file) {
      throw new NotFoundException('File not found or access denied');
    }

    try {
      // Delete file from filesystem
      await fs.unlink(file.storagePath);
    } catch (error) {
      // Log error but continue with database cleanup
      console.error('Failed to delete file from filesystem:', error);
    }

    // Remove from database
    await this.fileRepository.remove(file);

    // Log file deletion
    await this.logSecurityEvent('FILE_DELETE', ownerId, fileId);
  }

  async getFileStream(fileId: string, requesterId: string): Promise<{ stream: Buffer; file: File }> {
    const file = await this.getFileById(fileId);

    // Check access permissions
    if (!await this.hasFileAccess(file, requesterId)) {
      // Log unauthorized access attempt
      await this.logSecurityEvent('UNAUTHORIZED_FILE_ACCESS', requesterId, fileId);
      throw new ForbiddenException('Access denied to this file');
    }

    try {
      const fileBuffer = await fs.readFile(file.storagePath);
      
      // Log successful file access
      await this.logSecurityEvent('FILE_ACCESS', requesterId, fileId);
      
      return { stream: fileBuffer, file };
    } catch (error) {
      throw new NotFoundException('File not found on disk');
    }
  }

  private async logSecurityEvent(action: string, userId: string, resourceId: string): Promise<void> {
    try {
      // Create audit log entry
      await this.fileRepository.manager.query(`
        INSERT INTO audit_logs (user_id, action, resource_type, resource_id, created_at)
        VALUES ($1, $2, $3, $4, NOW())
      `, [userId, action, 'FILE', resourceId]);
    } catch (error) {
      // Log error but don't fail the main operation
      console.error('Failed to create audit log:', error);
    }
  }
}