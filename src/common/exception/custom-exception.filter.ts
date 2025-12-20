import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Prisma } from 'prisma/generated/client';

@Catch()
export class CustomExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();

    const isDev = process.env.NODE_ENV === 'development';

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Something went wrong';

    // =========================
    // DEV → Structured Error Log
    // =========================
    if (isDev) {
      console.log('\n==================== ❌ ERROR START ====================');

      if (exception instanceof Prisma.PrismaClientKnownRequestError) {
        console.log('🔴 Type      : Prisma Known Error');
        console.log('🧩 Code      :', exception.code);
        console.log('📄 Message   :', exception.message);
        console.log('📍 Meta      :', exception.meta);
      } else if (
        exception instanceof Prisma.PrismaClientInitializationError ||
        exception instanceof Prisma.PrismaClientUnknownRequestError ||
        exception instanceof Prisma.PrismaClientRustPanicError
      ) {
        console.log('🔴 Type      : Prisma Critical Error');
        console.log('📄 Message   :', exception.message);
      } else if (exception instanceof HttpException) {
        console.log('🟠 Type      : HttpException');
        console.log('📄 Status    :', exception.getStatus());
        console.log('📄 Response  :', exception.getResponse());
      } else if (exception instanceof Error) {
        console.log('⚫ Type      : JS Runtime Error');
        console.log('📄 Message   :', exception.message);
        console.log('📍 Stack     :', exception.stack);
      } else {
        console.log('⚪ Type      : Unknown Error');
        console.log('📄 Data      :', exception);
      }

      console.log('===================== ❌ ERROR END =====================\n');
    }

    // =========================
    // Safe Client Response
    // =========================
    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      message =
        typeof res === 'string' ? res : (res as any)?.message || message;
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      status = HttpStatus.BAD_REQUEST;

      const prismaMap: Record<string, string> = {
        P2002: 'Duplicate value already exists',
        P2025: 'Record not found',
      };

      message = prismaMap[exception.code] || 'Database operation failed';
    } else if (
      exception instanceof Prisma.PrismaClientInitializationError ||
      exception instanceof Prisma.PrismaClientUnknownRequestError ||
      exception instanceof Prisma.PrismaClientRustPanicError
    ) {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'Database service unavailable';
    } else {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'Internal server error';
    }

    response.status(status).json({
      success: false,
      message,
    });
  }
}
