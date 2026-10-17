import { gql, type TypedDocumentNode } from '@apollo/client/core'
import type { Me } from '@/api/types'

export const ME: TypedDocumentNode<{ me: Me }, { language: string }> = gql`
  query Me($language: String) {
    me {
      email
      role {
        id
        key
        locked
        name(language: $language)
      }
      permissions
    }
  }
`
