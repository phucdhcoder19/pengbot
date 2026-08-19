import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

/// 'NONE' = rút lại đánh giá. Dùng giá trị tường minh thay vì cho phép null:
/// widget luôn gửi TRẠNG THÁI CUỐI CÙNG nó muốn, nên endpoint idempotent —
/// gửi lại cùng một thứ hai lần không đảo ngược điều gì.
export const VOTES = ['UP', 'DOWN', 'NONE'] as const;
export type Vote = (typeof VOTES)[number];

export class FeedbackDto {
  /// TenantMiddleware đọc trường này để biết request thuộc công ty nào.
  @IsString()
  publicKey!: string;

  @IsUUID()
  messageId!: string;

  @IsIn(VOTES)
  vote!: Vote;

  /// Widget luôn gửi. Dùng để kiểm người chấm có đúng là chủ hội thoại không.
  @IsOptional()
  @IsString()
  @MaxLength(64)
  visitorId?: string;
}
