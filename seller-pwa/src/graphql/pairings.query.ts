import { gql, type TypedDocumentNode } from '@apollo/client/core'
import type { WaitingPairing } from '@/api/types'

export const WAITING_PAIRINGS: TypedDocumentNode<{ waitingPairings: WaitingPairing[] }> = gql`
  query WaitingPairings {
    waitingPairings {
      id
      device
      code
      loopback
      createdAt
    }
  }
`

/** Realtime: a simulator appeared or left, so the seller does not have to ask again */
export const WAITING_PAIRINGS_CHANGED: TypedDocumentNode<{ waitingPairingsChanged: WaitingPairing[] }> = gql`
  subscription WaitingPairingsChanged {
    waitingPairingsChanged {
      id
      device
      code
      loopback
      createdAt
    }
  }
`

export const DELIVER_TO_SIMULATOR: TypedDocumentNode<
  { deliverToSimulator: boolean },
  { pairingId: string; input: { robotId: string; apiKey: string } }
> = gql`
  mutation DeliverToSimulator($pairingId: ID!, $input: DeliverKeyInput!) {
    deliverToSimulator(pairingId: $pairingId, input: $input)
  }
`
