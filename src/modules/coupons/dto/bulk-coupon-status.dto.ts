import { IsEnum } from 'class-validator';
import { BulkIdsDto } from '../../../common/dto/bulk-ids.dto.js';
import { CouponStatus } from './create-coupon.dto.js';

export class BulkCouponStatusDto extends BulkIdsDto {
  @IsEnum(CouponStatus)
  status!: CouponStatus;
}
