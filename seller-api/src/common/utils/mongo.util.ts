import { ObjectId } from 'mongodb'
import { DomainException } from '../domain-exception.js'

/**
 * The id of a document is a string in GraphQL and an ObjectId in MongoDB: this is the one place that converts.
 * A text that is not an id is a bad request (400), not a crash.
 */
export const toObjectId = (id: string): ObjectId => {
  if (!ObjectId.isValid(id)) {
    throw new DomainException(400, 'invalid_id', 'This is not a valid id')
  }
  return new ObjectId(id)
}

/** Like toObjectId, for a list of ids; an id that is not valid is left out (the document cannot exist) */
export const toObjectIds = (ids: readonly string[]): ObjectId[] =>
  ids.filter(id => ObjectId.isValid(id)).map(id => new ObjectId(id))
