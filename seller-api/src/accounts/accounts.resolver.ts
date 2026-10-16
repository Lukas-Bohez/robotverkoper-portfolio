import { Args, Mutation, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql'
import { CurrentCaller, RequirePermissions } from '../authentication/decorators.js'
import type { Caller } from '../authentication/request.js'
import { SellerRole } from '../seller-roles/entities/seller-role.entity.js'
import { SellerRolesLoader } from '../seller-roles/seller-roles.loader.js'
import { AccountsService } from './accounts.service.js'
import { AddAccountInput } from './dto/add-account.input.js'
import { Account } from './entities/account.entity.js'

@Resolver(() => Account)
export class AccountsResolver {
  constructor(
    private readonly accounts: AccountsService,
    private readonly roles: SellerRolesLoader,
  ) {}

  @RequirePermissions('accounts:manage')
  @Query(() => [Account], {
    name: 'accounts',
    description: 'Our own staff, administrators of the settings first',
  })
  findAll(@Args('withDeleted', { defaultValue: false }) withDeleted: boolean): Promise<Account[]> {
    return this.accounts.findAll(withDeleted)
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
  @Mutation(() => Account, {
    description: 'Archives an account (soft delete): it can no longer log in and can be restored',
  })
  removeAccount(@CurrentCaller() caller: Caller, @Args('email') email: string): Promise<Account> {
    return this.accounts.remove(caller.email, email.trim().toLowerCase())
  }

  @RequirePermissions('archive:restore')
  @Mutation(() => Account)
  restoreAccount(@CurrentCaller() caller: Caller, @Args('email') email: string): Promise<Account> {
    return this.accounts.restore(caller.email, email.trim().toLowerCase())
  }

  /** The role of the account: one batched lookup for a whole list (a DataLoader), not one query per account */
  @ResolveField(() => SellerRole, { nullable: true })
  role(@Parent() account: Account): Promise<SellerRole | null> {
    return this.roles.load(account.roleKey)
  }
}
