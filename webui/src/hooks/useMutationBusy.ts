import { useSyncExternalStore } from 'react'
import { mutationBusy, subscribeMutations } from '../lib/mutationLock'

export function useMutationBusy() {
  return useSyncExternalStore(subscribeMutations, mutationBusy)
}
