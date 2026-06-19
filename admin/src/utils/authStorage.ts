const AUTH_FLAG = 'school-auth'

function canUseStorage() {
  try {
    return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined'
  } catch {
    return false
  }
}

export function readAuthFlag() {
  if (!canUseStorage()) {
    return false
  }

  try {
    return window.localStorage.getItem(AUTH_FLAG) === 'true'
  } catch {
    return false
  }
}

export function writeAuthFlag(value: boolean) {
  if (!canUseStorage()) {
    return
  }

  try {
    window.localStorage.setItem(AUTH_FLAG, value ? 'true' : 'false')
  } catch {
    // Ignore storage errors in restricted browsers.
  }
}