import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentUser = createParamDecorator(
  (_data: unknown, _context: ExecutionContext) => ({
    id: 'user_mock_123',
    companyId: 'company_mock_456',
    email: 'test@unique.ai',
  }),
);
