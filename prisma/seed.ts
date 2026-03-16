import { PrismaPg } from '@prisma/adapter-pg';
import cuid from 'cuid';
import pino from 'pino';
import { PrismaClient } from '../src/@generated/prisma-client';

const logger = pino({
  transport: {
    target: 'pino-pretty',
    options: {
      translateTime: 'SYS:yyyy-mm-dd HH:MM:ss',
      ignore: 'pid,hostname',
      colorize: true,
    },
  },
});

const assistants = [
  {
    name: 'UniqueAI',
    description:
      'AI-powered assistant for enterprise knowledge management and intelligent search across your entire organization',
  },
  {
    name: 'Internal Knowledge',
    description:
      'Internal documentation expert that helps teams find answers instantly from company wikis and documentation',
  },
  {
    name: 'Sales Intelligence Bot',
    description:
      'Analyzes sales patterns, customer interactions, and provides actionable insights for revenue growth',
  },
];

const realNames = [
  { firstName: 'John', lastName: 'Hauri' },
  { firstName: 'Dominik', lastName: 'Joao' },
  { firstName: 'Sarah', lastName: 'Chen' },
  { firstName: 'Michael', lastName: 'Schmidt' },
  { firstName: 'Emma', lastName: 'Rodriguez' },
];

async function main() {
  const connectionString = `${process.env.DATABASE_URL}`;
  const adapter = new PrismaPg({ connectionString });
  const prisma = new PrismaClient({ adapter });

  try {
    logger.info('Starting database seed...');

    const company = await prisma.company.upsert({
      where: { id: 'company_mock_456' },
      update: {
        name: 'Unique.ai',
      },
      create: {
        id: 'company_mock_456',
        name: 'Unique.ai',
      },
    });
    const secondCompany = await prisma.company.upsert({
      where: { id: 'company_mock_789' },
      update: {
        name: 'Unique Labs',
      },
      create: {
        id: 'company_mock_789',
        name: 'Unique Labs',
      },
    });

    logger.info({ company: company.name }, 'Company is ready');

    const mockUser = await prisma.user.upsert({
      where: { email: 'test@unique.ai' },
      update: {
        companyId: company.id,
      },
      create: {
        id: 'user_mock_123',
        email: 'test@unique.ai',
        companyId: company.id,
      },
    });

    logger.info({ email: mockUser.email }, 'Mock user is ready');
    const additionalMockUsers = [];
    for (const mock of [
      { id: 'user_mock_2', email: 'test-2@unique.ai' },
      { id: 'user_mock_3', email: 'test-3@unique.ai' },
    ]) {
      const user = await prisma.user.upsert({
        where: { id: mock.id },
        update: {
          email: mock.email,
          companyId: company.id,
        },
        create: {
          id: mock.id,
          email: mock.email,
          companyId: company.id,
        },
      });
      additionalMockUsers.push(user);
      logger.info({ email: user.email }, 'Additional mock user is ready');
    }
    const secondCompanyMockUser = await prisma.user.upsert({
      where: { email: 'test-labs@unique.ai' },
      update: {
        companyId: secondCompany.id,
      },
      create: {
        id: 'user_mock_789',
        email: 'test-labs@unique.ai',
        companyId: secondCompany.id,
      },
    });
    logger.info({ email: secondCompanyMockUser.email }, 'Second company mock user is ready');

    const additionalUsers = [];
    for (let i = 0; i < realNames.length; i++) {
      const { firstName, lastName } = realNames[i];
      const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}@unique.ai`;

      const user = await prisma.user.upsert({
        where: { email },
        update: {
          companyId: company.id,
        },
        create: {
          id: cuid(),
          email,
          companyId: company.id,
        },
      });

      additionalUsers.push(user);
      logger.info({ email: user.email }, 'User is ready');
    }

    const allUsers = [mockUser, ...additionalMockUsers, ...additionalUsers];
    const seededAssistants = [];

    for (let i = 0; i < assistants.length; i++) {
      const existingAssistant = await prisma.assistant.findFirst({
        where: {
          companyId: company.id,
          name: assistants[i].name,
        },
      });

      if (existingAssistant) {
        const assistant = await prisma.assistant.update({
          where: { id: existingAssistant.id },
          data: {
            description: assistants[i].description,
          },
        });

        seededAssistants.push(assistant);
        logger.info({ name: assistant.name, id: assistant.id }, 'Assistant already existed');
        continue;
      }

      const assistant = await prisma.assistant.create({
        data: {
          id: cuid(),
          name: assistants[i].name,
          description: assistants[i].description,
          companyId: company.id,
          createdBy: allUsers[i % allUsers.length].id,
        },
      });

      seededAssistants.push(assistant);
      logger.info({ name: assistant.name, id: assistant.id }, 'Assistant created');
    }

    logger.info(
      {
        companies: 2,
        users: allUsers.length + 1,
        assistants: seededAssistants.length,
      },
      'Seed summary',
    );

    logger.info(
      {
        email: mockUser.email,
        userId: mockUser.id,
        companyName: company.name,
        companyId: mockUser.companyId,
      },
      'Mock user credentials',
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  logger.error({ error }, 'Database seed failed');
  process.exit(1);
});
