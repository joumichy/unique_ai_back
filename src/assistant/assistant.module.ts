import { Module } from '@nestjs/common';
import { AssistantFacade } from './assistant.facade';
import { AssistantResolver } from './assistant.resolver';
import { AssistantService } from './assistant.service';

@Module({
  providers: [AssistantService, AssistantFacade, AssistantResolver],
  exports: [AssistantService, AssistantFacade],
})
export class AssistantModule {}

