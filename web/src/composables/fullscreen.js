export function fullscreenElement() {
  return document.fullscreenElement || null
}

export async function requestFullscreen(element) {
  const target = element || document.documentElement
  if (!target?.requestFullscreen) return false
  if (fullscreenElement() === target) return true
  try {
    await target.requestFullscreen({ navigationUI: 'hide' })
    return true
  } catch {
    return false
  }
}

export async function exitFullscreen() {
  if (!fullscreenElement() || !document.exitFullscreen) return true
  try {
    await document.exitFullscreen()
    return true
  } catch {
    return false
  }
}

export async function toggleFullscreen(element) {
  return fullscreenElement() ? exitFullscreen() : requestFullscreen(element)
}

