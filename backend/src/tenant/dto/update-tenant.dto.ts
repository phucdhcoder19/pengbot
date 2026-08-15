import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class UpdateTenantDto {
  /// Tên công ty hiển thị trong dashboard. KHÔNG đổi slug theo — slug đã nằm
  /// trong URL và tài liệu của khách, đổi là gãy liên kết cũ.
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  /// Danh sách domain được nhúng widget. Rỗng = cho phép tất cả.
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @Matches(/^[a-z0-9.-]+$/i, {
    each: true,
    message:
      'Domain chỉ gồm chữ, số, dấu chấm và gạch ngang — không có http://',
  })
  allowedDomains?: string[];

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  widgetTitle?: string;

  @IsOptional()
  @Matches(/^#[0-9a-fA-F]{6}$/, { message: 'Màu phải dạng #RRGGBB' })
  widgetColor?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  widgetGreeting?: string;
}
