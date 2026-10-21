/**
 * Release server-side resources before desktop quit (5.1.0 CLI-18).
 */
export async function releaseAllResources(port) {
  const base = `http://127.0.0.1:${port}`
  try {
    await fetch(`${base}/api/resources/release`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    })
  } catch {
    /* server may already be down */
  }
}
