import { Injectable } from '@nestjs/common';
import { GraphQLResolveInfo } from 'graphql';
import { Prisma } from '../@generated/prisma-client';
import { getQueryIncludeSelect } from '../common/utils/graphql-fields.util';
import { PrismaService } from '../prisma/prisma.service';

interface CreateAssistantPayload {
  name: string;
  description?: string;
  companyId: string;
  createdBy: string;
}

@Injectable()
export class AssistantFacade {
  constructor(private readonly prisma: PrismaService) {}

  public async createAssistant(data: CreateAssistantPayload, info?: GraphQLResolveInfo) {
    const query = getQueryIncludeSelect<Prisma.AssistantInclude, Prisma.AssistantSelect>(
      Prisma.dmmf,
      { info },
    );

    return await this.prisma.assistant.create({
      data: {
        name: data.name,
        description: data.description,
        companyId: data.companyId,
        createdBy: data.createdBy,
      },
      ...query,
    });
  }

  public async findAssistantById(id: string, info?: GraphQLResolveInfo) {
    const query = getQueryIncludeSelect<Prisma.AssistantInclude, Prisma.AssistantSelect>(
      Prisma.dmmf,
      { info },
    );

    return await this.prisma.assistant.findUnique({
      where: { id },
      ...query,
    });
  }

  public async findAssistantsByCompany(companyId: string, info?: GraphQLResolveInfo) {
    const query = getQueryIncludeSelect<Prisma.AssistantInclude, Prisma.AssistantSelect>(
      Prisma.dmmf,
      { info },
    );

    return await this.prisma.assistant.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      ...query,
    });
  }
}

