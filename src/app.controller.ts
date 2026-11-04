import { Controller, Get } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ApiErrorCode, ApiException } from './common/errors/api-error';

@Controller()
export class AppController {
  constructor(private readonly dataSource: DataSource) {}

  @Get('health')
  async getHealth() {
    try {
      await this.dataSource.query('SELECT 1');
      return { status: 'ok', dependencies: { database: 'ok' } };
    } catch {
      throw new ApiException(503, ApiErrorCode.INTERNAL_ERROR, '서비스 상태를 확인할 수 없습니다.');
    }
  }
}
