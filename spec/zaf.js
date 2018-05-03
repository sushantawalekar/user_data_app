function appendParams (url, params) {
  let hashIndex = url.indexOf('#')
  let urlBeforeHash = hashIndex > 0 ? url.substring(0, hashIndex) : url
  let hasParams = urlBeforeHash.indexOf('?') > 0
  let divider = hasParams ? '&' : '?'
  let urlWithParams = urlBeforeHash + divider + params

  if (hashIndex > 0) {
    return urlWithParams + url.substring(hashIndex)
  }

  return urlWithParams
}

// Mock url params required by ZAF SDK
if (window.history.pushState) {
  let url = window.location.href
  let origin = encodeURIComponent(window.top.location.origin)
  let appGuid = '36618c17-34c9-4ec3-8daa-24a9fa728461'
  let newUrl = appendParams(url, `origin=${origin}&app_guid=${appGuid}`)
  window.history.pushState({ path: newUrl }, '', newUrl)
}
