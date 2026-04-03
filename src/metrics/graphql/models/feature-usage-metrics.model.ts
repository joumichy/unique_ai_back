import { Field, ObjectType } from '@nestjs/graphql';
import { DailyActiveUserBucketModel } from './daily-active-user-bucket.model';
import { WeeklyActiveUserBucketModel } from './weekly-active-user-bucket.model';

@ObjectType()
export class FeatureUsageMetricsModel {
  @Field(() => [DailyActiveUserBucketModel])
  dailyActiveUsers: DailyActiveUserBucketModel[];

  @Field(() => [WeeklyActiveUserBucketModel])
  weeklyActiveUsers: WeeklyActiveUserBucketModel[];
}
