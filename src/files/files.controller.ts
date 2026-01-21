import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  UseInterceptors,
  UploadedFile,
  UseGuards,
  Res,
  HttpStatus,
  ParseUUIDPipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiResponse, ApiConsumes, ApiBearerAuth } from '@nestjs/swagger';
import { FilesService } from './files.service';
import { FileUploadResponseDto } from './dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/entities/user.entity';

@ApiTags('files')
@Controller('files')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Post('resume')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ summary: 'Upload resume file' })
  @ApiConsumes('multipart/form-data')
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: 'File uploaded successfully',
    type: FileUploadResponseDto,
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: 'Invalid file or validation failed',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Authentication required',
  })
  async uploadResume(
    @UploadedFile() file: Express.Multer.File,
    @CurrentUser() user: User,
  ): Promise<FileUploadResponseDto> {
    if (!file) {
      throw new Error('No file provided');
    }

    return this.filesService.uploadResume(user.id, file);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Download file by ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'File downloaded successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'File not found',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Access denied to this file',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Authentication required',
  })
  async downloadFile(
    @Param('id', ParseUUIDPipe) fileId: string,
    @CurrentUser() user: User,
    @Res() response: Response,
  ): Promise<void> {
    const { stream, file } = await this.filesService.getFileStream(fileId, user.id);

    // Set appropriate headers for file download
    response.setHeader('Content-Type', file.mimeType);
    response.setHeader('Content-Length', file.sizeBytes);
    response.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(file.originalName)}"`,
    );
    response.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    response.setHeader('Pragma', 'no-cache');
    response.setHeader('Expires', '0');

    response.end(stream);
  }

  @Get(':id/view')
  @ApiOperation({ summary: 'View file inline (for PDFs)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'File viewed successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'File not found',
  })
  @ApiResponse({
    status: HttpStatus.FORBIDDEN,
    description: 'Access denied to this file',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Authentication required',
  })
  async viewFile(
    @Param('id', ParseUUIDPipe) fileId: string,
    @CurrentUser() user: User,
    @Res() response: Response,
  ): Promise<void> {
    const { stream, file } = await this.filesService.getFileStream(fileId, user.id);

    // Set appropriate headers for inline viewing
    response.setHeader('Content-Type', file.mimeType);
    response.setHeader('Content-Length', file.sizeBytes);
    response.setHeader(
      'Content-Disposition',
      `inline; filename="${encodeURIComponent(file.originalName)}"`,
    );
    response.setHeader('Cache-Control', 'private, max-age=3600');

    response.end(stream);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete file by ID' })
  @ApiResponse({
    status: HttpStatus.NO_CONTENT,
    description: 'File deleted successfully',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: 'File not found or access denied',
  })
  @ApiResponse({
    status: HttpStatus.UNAUTHORIZED,
    description: 'Authentication required',
  })
  async deleteFile(
    @Param('id', ParseUUIDPipe) fileId: string,
    @CurrentUser() user: User,
  ): Promise<void> {
    await this.filesService.deleteResume(fileId, user.id);
  }
}