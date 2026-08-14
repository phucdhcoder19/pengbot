import {
  ConflictException,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { type ExtendedPrismaClient, PRISMA } from '../prisma/prisma';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { randomBytes } from 'crypto';
@Injectable()
export class AuthService {
  constructor(
    @Inject(PRISMA) private readonly prisma: ExtendedPrismaClient,
    private readonly jwt: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existing) throw new ConflictException('Email already taken');
    const passwordHash = await argon2.hash(dto.password);

    const tenant = await this.prisma.tenant.create({
      data: {
        name: dto.companyName,
        slug: this.makeSlug(dto.companyName),
        publicKey: 'pk_' + randomBytes(24).toString('base64url'),
        users: { create: { email: dto.email, passwordHash } },
      },
      include: { users: true },
    });
    return this.issueToken(tenant.users[0], tenant);
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: { tenant: true },
    });

    // ⚠️ Cùng một thông báo cho cả "không có email" lẫn "sai mật khẩu".
    // Tách ra là kẻ tấn công dò được email nào đã đăng ký.
    if (!user)
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');

    const ok = await argon2.verify(user.passwordHash, dto.password);
    if (!ok) throw new UnauthorizedException('Email hoặc mật khẩu không đúng');

    return this.issueToken(user, user.tenant);
  }

  private async issueToken(
    user: { id: string; email: string; tenantId: string },
    tenant: { id: string; name: string; slug: string; publicKey: string },
  ) {
    const accessToken = await this.jwt.signAsync({
      sub: user.id,
      tenantId: user.tenantId,
      email: user.email,
    });

    return {
      accessToken,
      user: { id: user.id, email: user.email },
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        publicKey: tenant.publicKey, // dashboard cần cái này để dựng snippet
      },
    };
  }

  private makeSlug(name: string) {
    const base =
      name
        .toLowerCase()
        .normalize('NFD') // tách dấu tiếng Việt ra khỏi chữ
        .replace(/[\u0300-\u036f]/g, '') // xóa dấu
        .replace(/đ/g, 'd')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '') || 'cong-ty';
    // hậu tố ngẫu nhiên: hai công ty trùng tên vẫn có slug khác nhau
    return `${base}-${randomBytes(3).toString('hex')}`;
  }
}
