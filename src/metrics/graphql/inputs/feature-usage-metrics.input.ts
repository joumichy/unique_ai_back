import { Field, InputType } from '@nestjs/graphql';

@InputType()
export class FeatureUsageMetricsInput {
  @Field(() => String, {
    description: 'Inclusive start day in YYYY-MM-DD format',
  })
  from: string;

  @Field(() => String, {
    description: 'Inclusive end day in YYYY-MM-DD format',
  })
  to: string;

  @Field(() => String, {
    nullable: true,
    description:
      'Optional company scope. When omitted, the authenticated user company is used',
  })
  companyId?: string;

  @Field(() => String, {
    nullable: true,
    description: 'Optional feature filter using snake_case naming',
  })
  feature?: string;
}
