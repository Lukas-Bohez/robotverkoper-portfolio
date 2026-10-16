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
    description: 'The companies that use our robots, with their robots and defects',
  })
  list(): Promise<CompanyList> {
    return this.companies.list()
  }

  @RequirePermissions('companies:read')
  @Query(() => Company, { name: 'company' })
  get(@Args('id', { type: () => ID }) id: string): Promise<Company> {
    return this.companies.get(id)
  }

  @RequirePermissions('companies:create')
  @Mutation(() => Company, { description: 'Creates a company at the platform, with its first administrator' })
  createCompany(
    @CurrentCaller() caller: Caller,
    @Args('input') input: CreateCompanyInput,
  ): Promise<Company> {
    return this.companies.create(caller.email, input)
  }
}
