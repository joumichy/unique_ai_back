import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class IngestFeatureUsageEventPayload {
  @Field(() => String)
  eventId: string;

  @Field(() => String)
  userId: string;

  @Field(() => String)
  feature: string;

  @Field(() => Date)
  occurredAt: Date;

  @Field(() => String)
  occurredDayUtc: string;
}
