import { gql, type TypedDocumentNode } from '@apollo/client/core'
import type { Me } from '@/api/types'

export const ME: TypedDocumentNode<{ me: Me }> = gql`
  query Me {
    me {
      email
      role
      permissions
    }
  }
`
