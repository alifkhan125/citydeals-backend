import { IsUrl } from 'class-validator';

export class UpdateStoreLinksDto {
  @IsUrl({ protocols: ['https'], require_protocol: true })
  playStoreUrl!: string;

  @IsUrl({ protocols: ['https'], require_protocol: true })
  appStoreUrl!: string;
}
