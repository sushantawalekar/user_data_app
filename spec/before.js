const originalInit = window.ZAFClient.init

window.ZAFClient.init = (cb) => {
  const origin = encodeURIComponent(window.top.location.origin)
  const appGuid = '36618c17-34c9-4ec3-8daa-24a9fa728461'

  return originalInit(cb, {
    search: `origin=${origin}&app_guid=${appGuid}`,
    hash: ''
  })
}
