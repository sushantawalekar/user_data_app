Note: Run commands in the root app directory. And obviously you don't need to run npm install all the time...

Compile the app for DEV
===============
1) `npm install`
3) `npm run watch`
4) `zat server -p dist` - Serves the app to your zendesk instance with `?zat=true`

Compile the app for PROD
===============
1) `npm install --only=production`
2) `zat translate to_json -p src`
3) `zat translate update -p src` - This will download the newest translations from Rosetta
4) `npm run build`

To test other languages
===============
1) `zat translate to_json -p src`
2) `zat translate update -p src` - This will download the newest translations from Rosetta

To run the tests
===============
1) `npm install`
2) `zat translate to_json -p src`
3) `npm run test`

To run linter
===============
1) `npm install`
2) `npm run lint`
