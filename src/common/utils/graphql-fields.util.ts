import { PrismaSelect } from '@konsti/paljs-plugins-fork';
import { GraphQLResolveInfo } from 'graphql';
import { merge } from 'lodash';

export interface IncludeSelectOptions<IncludeType, SelectType> {
  include?: IncludeType;
  defaultSelect?: { select?: SelectType };
  info?: GraphQLResolveInfo;
}

export interface IncludeSelectArguments<IncludeType, SelectType> {
  include?: IncludeType;
  select?: SelectType;
}

export function getQueryIncludeSelect<IncludeType, SelectType>(
  dmmf: unknown,
  options?: IncludeSelectOptions<IncludeType, SelectType>,
): IncludeSelectArguments<IncludeType, SelectType> {
  if (!options) return {};

  if (options.include && (options.defaultSelect ?? options.info)) {
    throw new Error('Cannot use include and select at the same time');
  }

  if (options.include) {
    return { include: options.include };
  }

  const defaultSelect = options.defaultSelect ? { ...options.defaultSelect } : { select: undefined };

  return options.info
    ? merge(
        {},
        defaultSelect,
        new PrismaSelect(options.info, { dmmf: [dmmf] } as never).value,
      )
    : defaultSelect;
}
