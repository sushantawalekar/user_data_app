const exec = require('child_process').exec
const fs = require('fs')
const zlib = require('zlib')

Promise.resolve().then(() => {
  return new Promise((resolve, reject) => {
    exec('npm run build -- --env.stats', (error, stdout, stderr) => {
      if (error) reject(stderr)
      resolve()
    })
  })
}).then(() => {
  exec('open ./dist/statistics.html')
}).then((result) => {
  return new Promise((resolve, reject) => {
    fs.readFile('./dist/assets/bundle.js', 'utf8', (err, data) => {
      if (err) reject(err)
      resolve(data)
    })
  })
}).then((bundleContent) => {
  return new Promise((resolve, reject) => {
    zlib.gzip(bundleContent, (err, buffer) => {
      if (err) reject(err)
      resolve({ original: bundleContent.length, compressed: buffer.length })
    })
  })
}).then((result) => {
  console.log('original', result.original.toString().padStart(15))
  console.log('original gzip', result.compressed.toString().padStart(10))
}).catch((err) => {
  console.error(err)
})
