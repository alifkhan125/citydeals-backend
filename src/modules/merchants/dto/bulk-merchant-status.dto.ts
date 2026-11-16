import { IsEnum } from 'class-validator';
import { BulkIdsDto } from '../../../common/dto/bulk-ids.dto.js';
import { MerchantStatus } from './create-merchant.dto.js';

export class BulkMerchantStatusDto extends BulkIdsDto {
  @IsEnum(MerchantStatus)
  status!: MerchantStatus;
}
