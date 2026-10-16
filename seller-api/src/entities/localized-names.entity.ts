import { Field, InputType, ObjectType } from '@nestjs/graphql'
import { IsOptional, Length } from 'class-validator'

/** The languages of the app (the same as the translations of the PWA) */
export const LANGUAGES = ['nl', 'en', 'fr', 'de'] as const
export type Language = (typeof LANGUAGES)[number]

/**
 * A name in every language: a role is "Technicus" in Dutch, "Technician" in English, "Technicien" in French and
 * "Techniker" in German. A language that is left empty falls back (see `localizedName`). An embedded document.
 */
@InputType('LocalizedNamesInput') // also an input type
@ObjectType()
export class LocalizedNames {
  @IsOptional()
  @Length(1, 40)
  @Field(() => String, { nullable: true })
  nl?: string | null

  @IsOptional()
  @Length(1, 40)
  @Field(() => String, { nullable: true })
  en?: string | null

  @IsOptional()
  @Length(1, 40)
  @Field(() => String, { nullable: true })
  fr?: string | null

  @IsOptional()
  @Length(1, 40)
  @Field(() => String, { nullable: true })
  de?: string | null
}

/**
 * The name to show: the asked language, else English, else any language that has one, else the fallback (the
 * key of the role). So a role that is not translated yet never shows up empty.
 */
export function localizedName(
  names: Partial<Record<Language, string | null>> | null | undefined,
  language: string | null | undefined,
  fallback: string,
): string {
  const wanted = (language ?? '').toLowerCase().slice(0, 2)
  const order: string[] = [wanted, 'en', ...LANGUAGES]
  for (const code of order) {
    const name = names?.[code as Language]
    if (typeof name === 'string' && name.trim() !== '') return name
  }
  return fallback
}

/** The languages that still miss a name (the screen shows "FR en DE ontbreken") */
export function missingLanguages(names: Partial<Record<Language, string | null>> | null | undefined): Language[] {
  return LANGUAGES.filter(code => {
    const name = names?.[code]
    return typeof name !== 'string' || name.trim() === ''
  })
}
