import { ArgumentsHost, Catch, ExceptionFilter, HttpException, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    let status = 500;
    let message = 'Something went wrong. Please try again.';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      message = exception.message;

      if (typeof exceptionResponse === 'object' && exceptionResponse !== null && 'message' in exceptionResponse) {
        const responseMessage = (exceptionResponse as any).message;
        message = Array.isArray(responseMessage) ? responseMessage.join(', ') : String(responseMessage);
      }
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === 'P2002') {
        status = 409;
        message = 'This value already exists. Please use a different value.';
      } else if (exception.code === 'P2003') {
        status = 409;
        message = 'This action is blocked because related data still exists.';
      }
      this.logger.error(`${exception.code}: ${exception.message}`);
    } else if (exception instanceof Error) {
      this.logger.error(exception.stack ?? exception.message);
    } else {
      this.logger.error(String(exception));
    }

    response.status(status).json({
      statusCode: status,
      message,
      timestamp: new Date().toISOString(),
    });
  }
}
