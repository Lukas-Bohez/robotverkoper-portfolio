import { Args, Mutation, Query, Resolver } from '@nestjs/graphql'
import { CurrentCaller, RequirePermissions } from '../authentication/decorators.js'
import type { Caller } from '../authentication/request.js'
import { AccountsService } from './accounts.service.js'
import { AddAccountInput } from './dto/add-account.input.js'
import { Account } from './entities/account.entity.js'

@Resolver(() => Account)
export class AccountsResolver {
  constructor(private readonly accounts: AccountsService) {}

  @RequirePermissions('accounts:manage')
  @Query(() => [Account], { name: 'accounts', description: 'Our own staff, administrators of the settings first' })
  list(): Promise<Account[]> {
    return this.accounts.list()
  }

  @RequirePermissions('accounts:manage')
  @Mutation(() => Account, { description: 'Gives someone a role (or changes it)' })
  addAccount(
    @CurrentCaller() caller: Caller,
    @Args('input') input: AddAccountInput,
  ): Promise<Account> {
    return this.accounts.add(caller.email, input)
  }

  @RequirePermissions('accounts:manage')
  @Mutation(() => Boolean, { description: 'Takes the role of someone away' })
  async removeAccount(
    @CurrentCaller() caller: Caller,
    @Args('email') email: string,
  ): Promise<boolean> {
    await this.accounts.remove(caller.email, email.trim().toLowerCase())
    return true
  }
}
