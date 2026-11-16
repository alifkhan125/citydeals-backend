import { IsEnum } from 'class-validator';
import { BulkIdsDto } from './bulk-ids.dto.js';
import { ContentStatus } from '@prisma/client';

export class BulkCategoryStatusDto extends BulkIdsDto {
  @IsEnum(ContentStatus)
  status!: ContentStatus;
}
