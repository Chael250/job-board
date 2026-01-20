import { ApiProperty } from '@nestjs/swagger';

export class FileUploadResponseDto {
  @ApiProperty({ description: 'Unique file identifier' })
  fileId: string;

  @ApiProperty({ description: 'Original filename' })
  originalName: string;

  @ApiProperty({ description: 'File size in bytes' })
  size: number;

  @ApiProperty({ description: 'MIME type of the file' })
  mimeType: string;

  @ApiProperty({ description: 'Upload timestamp' })
  uploadedAt: Date;
}