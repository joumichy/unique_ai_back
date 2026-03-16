import { Logger } from '@nestjs/common';
import { Args, Field, Info, InputType, Mutation, Query, Resolver } from '@nestjs/graphql';
import { GraphQLResolveInfo } from 'graphql';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AssistantModel } from './assistant.model';
import { AssistantService } from './assistant.service';

interface User {
  id: string;
  companyId: string;
  email: string;
}

@InputType()
export class CreateAssistantInput {
  @Field(() => String)
  name: string;

  @Field(() => String, { nullable: true })
  description?: string;
}

@Resolver(() => AssistantModel)
export class AssistantResolver {
  private readonly logger = new Logger(AssistantResolver.name);

  constructor(private readonly assistantService: AssistantService) {}

  @Mutation(() => AssistantModel)
  async createAssistant(
    @CurrentUser() user: User,
    @Args('input') input: CreateAssistantInput,
    @Info() info: GraphQLResolveInfo,
  ): Promise<AssistantModel> {
    this.logger.log(`User ${user.id} creating assistant: ${input.name}`);

    return this.assistantService.createAssistant(input, user.id, user.companyId, info);
  }

  @Query(() => AssistantModel, { nullable: true })
  async assistant(
    @Args('id') id: string,
    @Info() info: GraphQLResolveInfo,
  ): Promise<AssistantModel | null> {
    return this.assistantService.getAssistantById(id, info);
  }

  @Query(() => [AssistantModel])
  async assistants(
    @CurrentUser() user: User,
    @Info() info: GraphQLResolveInfo,
  ): Promise<AssistantModel[]> {
    return this.assistantService.getAssistantsByCompany(user.companyId, info);
  }
}
