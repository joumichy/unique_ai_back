import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';

/**
 * Mock @CurrentUser() decorator for the take-home challenge
 *
 * In a real application, this decorator would:
 * - Extract the JWT token from the request headers
 * - Validate the token and decode the payload
 * - Return the authenticated user object
 *
 * For this challenge, we're mocking it to return a hardcoded user.
 * This allows you to focus on the metrics logic without implementing authentication.
 *
 * Usage in resolvers:
 *   @Mutation(() => Boolean)
 *   async trackEvent(@CurrentUser() user: User, @Args('input') input: TrackEventInput) {
 *     // user.id and user.companyId are available here
 *   }
 */
export const CurrentUser = createParamDecorator(
  (data: unknown, context: ExecutionContext) => {
    const ctx = GqlExecutionContext.create(context);
    const request = ctx.getContext().req;

    // TODO: In a real app, extract from JWT:
    // const token = request.headers.authorization?.split(' ')[1];
    // const decoded = jwt.verify(token, secret);
    // return decoded.user;

    // For this challenge, return a mock user
    return {
      id: 'user_mock_123',
      companyId: 'company_mock_456',
      email: 'test@unique.ai',
    };
  },
);
