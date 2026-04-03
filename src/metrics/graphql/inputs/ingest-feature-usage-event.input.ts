import { Field, InputType } from '@nestjs/graphql';

@InputType()
export class IngestFeatureUsageEventInput {
  @Field(() => String, {
    description: 'Idempotency key supplied by the client for the usage event',
  })
  eventId: string;

  @Field(() => String, {
    description: 'Logical user identifier tied to the feature usage event',
  })
  userId: string;

  @Field(() => String, {
    description: 'Feature key using snake_case naming',
  })
  feature: string;

  @Field(() => String, {
    description: 'ISO-8601 timestamp including timezone information',
  })
  occurredAt: string;
}
