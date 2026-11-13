let busy = false
const listeners = new Set<() => void>()

export const mutationBusy = () => busy
export const subscribeMutations = (listener: () => void) => {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export async function runMutation(task: () => Promise<void>): Promise<boolean> {
  if (busy) return false
  busy = true
  listeners.forEach(listener => listener())
  try {
    await task()
    return true
  } finally {
    busy = false
    listeners.forEach(listener => listener())
  }
}
