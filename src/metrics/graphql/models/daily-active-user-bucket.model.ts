import { Field, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class DailyActiveUserBucketModel {
  @Field(() => String)
  companyId: string;

  @Field(() => String)
  feature: string;

  @Field(() => Int)
  activeUsers: number;

  @Field(() => String)
  dayUtc: string;
}
