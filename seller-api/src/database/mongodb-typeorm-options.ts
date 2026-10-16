/** TypeORM connection options for MongoDB, derived from the MONGODB_URI of the settings. */
export interface MongodbTypeOrmOptions {
  type: 'mongodb'
  url: string
  autoLoadEntities: true
  /** TypeORM keeps the entities and their indexes in step by itself, in development only */
  synchronize: boolean
}

export function createMongodbTypeOrmOptions(
  mongodbUri: string,
  options: { synchronize: boolean },
): MongodbTypeOrmOptions {
  return {
    type: 'mongodb',
    url: mongodbUri,
    autoLoadEntities: true,
    synchronize: options.synchronize,
  }
}
