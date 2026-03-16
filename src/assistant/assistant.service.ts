import { Injectable, Logger } from '@nestjs/common';
import { GraphQLResolveInfo } from 'graphql';
import { AssistantFacade } from './assistant.facade';

interface CreateAssistantInput {
  name: string;
  description?: string;
}

@Injectable()
export class AssistantService {
  private readonly logger = new Logger(AssistantService.name);

  constructor(private readonly assistantFacade: AssistantFacade) {}

  async createAssistant(
    input: CreateAssistantInput,
    userId: string,
    companyId: string,
    info?: GraphQLResolveInfo,
  ) {
    this.logger.log(`Creating assistant: ${input.name} for company: ${companyId}`);

    const assistant = await this.assistantFacade.createAssistant(
      {
        name: input.name,
        description: input.description,
        companyId,
        createdBy: userId,
      },
      info,
    );

    return assistant;
  }

  async getAssistantById(id: string, info?: GraphQLResolveInfo) {
    return this.assistantFacade.findAssistantById(id, info);
  }

  async getAssistantsByCompany(companyId: string, info?: GraphQLResolveInfo) {
    return this.assistantFacade.findAssistantsByCompany(companyId, info);
  }
}

