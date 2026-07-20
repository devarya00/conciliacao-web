import { Global, Inject, Module, OnModuleDestroy } from '@nestjs/common';
import knex, { Knex } from 'knex';
import config from './knexfile';

export const KNEX_CONNECTION = 'KNEX_CONNECTION';

@Global()
@Module({
  providers: [
    {
      provide: KNEX_CONNECTION,
      useFactory: (): Knex => knex(config),
    },
  ],
  exports: [KNEX_CONNECTION],
})
export class KnexModule implements OnModuleDestroy {
  constructor(@Inject(KNEX_CONNECTION) private readonly db: Knex) {}

  async onModuleDestroy() {
    await this.db.destroy();
  }
}
