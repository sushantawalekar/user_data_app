export function localStorage (keyOrObject, value) {
  if (value === undefined) {
    return JSON.parse(window.localStorage.getItem(`user_data_app:${keyOrObject}`))
  } else if (typeof keyOrObject === 'string') {
    window.localStorage.setItem(`user_data_app:${keyOrObject}`, JSON.stringify(value))
  } else if (typeof keyOrObject === 'object') {
    Object.keys(keyOrObject).forEach((key) => {
      window.localStorage.setItem(`user_data_app:${key}`, JSON.stringify(keyOrObject[key]))
    })
  }
}

const _settings = {}
export function setting (key, value) {
  if (key === undefined) {
    return _settings
  } else if (value === undefined) {
    return _settings[key]
  } else {
    _settings[key] = value
  }
}

const _storage = {}
export function storage (key, value) {
  if (key === undefined) {
    return _storage
  } else if (value === undefined) {
    return _storage[key]
  } else {
    _storage[key] = value
  }
}
