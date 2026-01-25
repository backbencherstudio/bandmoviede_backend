import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import appConfig from '../../../config/app.config';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      // ignoreExpiration: false,
      ignoreExpiration: true,
      secretOrKey: appConfig().jwt.secret,
    });
  }

  async validate(payload: any) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Track user activity asynchronously (non-blocking)
    this.trackUserActivity(user.id);

    return { userId: user.id, email: user.email };
  }

  /**
   * Track user activity for analytics
   * Runs asynchronously and never throws errors
   */
  private trackUserActivity(userId: string): void {
    if (!userId) return;

    setImmediate(async () => {
      try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        await this.prisma.userActivity.upsert({
          where: {
            user_id_activity_date: {
              user_id: userId,
              activity_date: today,
            },
          },
          update: {}, // No update needed, just track the date
          create: {
            user_id: userId,
            activity_date: today,
          },
        });
      } catch (error) {
        // Silent fail - analytics should never break authentication
        if (process.env.NODE_ENV === 'development') {
          console.error(
            '[JwtStrategy] Activity tracking failed:',
            error.message,
          );
        }
      }
    });
  }
}
