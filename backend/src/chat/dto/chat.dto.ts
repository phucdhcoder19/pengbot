import {
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class ChatDto {
  /// Nằm trong snippet widget, công khai. TenantMiddleware đọc trường này
  /// để biết request thuộc công ty nào.
  @IsString()
  publicKey!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(2000) // chặn payload khổng lồ làm phình chi phí embed
  message!: string;

  /// Có = chat tiếp phiên cũ. Không có = mở phiên mới.
  @IsOptional()
  @IsUUID()
  conversationId?: string;

  /// Widget tự sinh và lưu trong localStorage, để nối các phiên của cùng một khách.
  @IsOptional()
  @IsString()
  @MaxLength(64)
  visitorId?: string;
}
