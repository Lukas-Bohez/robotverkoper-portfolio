import { Field, InputType, ObjectType } from '@nestjs/graphql'
import { Type } from 'class-transformer'
import { IsNotEmpty, MinLength, ValidateNested } from 'class-validator'
import type { Point } from 'geojson'
import { GeoPoint } from './geopoint.entity.js'

/** Where a robot (or a defect) is: a readable address and the point on the map. An embedded document. */
@InputType('LocationInput') // also an input type
@ObjectType()
export class Location {
  @IsNotEmpty()
  @MinLength(2)
  @Field(() => String)
  country: string

  @IsNotEmpty()
  @MinLength(2)
  @Field(() => String)
  address: string

  @ValidateNested()
  @Type(() => GeoPoint) // without this, the nested object is not validated
  @Field(() => GeoPoint)
  geometry: Point
}
