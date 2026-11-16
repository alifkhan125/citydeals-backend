import { ArrayNotEmpty, IsArray, IsString } from 'class-validator';

export class BulkIdsDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  ids!: string[];
}
