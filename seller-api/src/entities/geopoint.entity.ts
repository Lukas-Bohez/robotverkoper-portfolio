import { Field, Float, InputType, ObjectType } from '@nestjs/graphql'
import { ArrayMaxSize, ArrayMinSize, Equals, IsNotEmpty } from 'class-validator'
import type { Point } from 'geojson'

/**
 * A GeoJSON point. The package `geojson` has only interfaces, so this class implements `Point` and can be used in
 * a `@Field()`. It is an embedded document: it has no TypeORM decorators.
 */
@InputType('GeoPointInput') // also an input type
@ObjectType()
export class GeoPoint implements Point {
  @IsNotEmpty()
  @Equals('Point')
  @Field(() => String, { description: 'GeoJSON asks for the value Point' })
  type: 'Point'

  @IsNotEmpty()
  @ArrayMinSize(2)
  @ArrayMaxSize(2)
  @Field(() => [Float], { description: 'Coordinates as [longitude, latitude]' })
  coordinates: number[]
}
