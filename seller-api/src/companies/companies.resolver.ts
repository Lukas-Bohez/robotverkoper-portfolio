import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql'
import { CurrentCaller, RequirePermissions } from '../authentication/decorators.js'
import type { Caller } from '../authentication/request.js'
import { CompaniesService } from './companies.service.js'
import { CreateCompanyInput } from './dto/create-company.input.js'
import { Company, CompanyList } from './entities/company.entity.js'

@Resolver(() => Company)
export class CompaniesResolver {
  constructor(private readonly companies: CompaniesService) {}

  @RequirePermissions('companies:read')
  @Query(() => CompanyList, {
    name: 'companies',
    description:
      'The companies that use our robots, with their robots and defects. Archived companies only when asked for.',
  })
  findAll(
    @Args('withDeleted', { defaultValue: false }) withDeleted: boolean,
  ): Promise<CompanyList> {
    return this.companies.findAll(withDeleted)
  }

  @RequirePermissions('companies:read')
  @Query(() => Company, { name: 'company' })
  findOne(
    @Args('id', { type: () => ID }) id: string,
    @Args('withDeleted', { defaultValue: false }) withDeleted: boolean,
  ): Promise<Company> {
    return this.companies.findOne(id, withDeleted)
  }

  @RequirePermissions('companies:create')
  @Mutation(() => Company, {
    description: 'Creates a company at the platform, with its first administrator',
  })
  createCompany(
    @CurrentCaller() caller: Caller,
    @Args('input') input: CreateCompanyInput,
  ): Promise<Company> {
    return this.companies.create(caller.email, input)
  }

  @RequirePermissions('companies:archive')
  @Mutation(() => Company, {
    description: 'Archives a company (soft delete): it leaves the lists and can be restored',
  })
  removeCompany(
    @CurrentCaller() caller: Caller,
    @Args('id', { type: () => ID }) id: string,
  ): Promise<Company> {
    return this.companies.remove(caller.email, id)
  }

  @RequirePermissions('archive:restore')
  @Mutation(() => Company)
  restoreCompany(
    @CurrentCaller() caller: Caller,
    @Args('id', { type: () => ID }) id: string,
  ): Promise<Company> {
    return this.companies.restore(caller.email, id)
  }
}
