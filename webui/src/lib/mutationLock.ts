let busy = false

export async function runMutation(task: () => Promise<void>): Promise<boolean> {
  if (busy) return false
  busy = true
  try {
    await task()
    return true
  } finally {
    busy = false
  }
}
