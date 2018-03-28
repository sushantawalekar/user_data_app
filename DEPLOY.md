Note: Run commands in the root app directory. And obviously you don't need to run yarn install all the time...

Compile the app for DEV
===============
1) `yarn install`
3) `yarn watch`
4) `zat server -p dist` - Serves the app to your zendesk instance with `?zat=true`

Compile the app for PROD
===============
1) `yarn install`
2) `zat translate to_json -p src`
3) `zat translate update -p src` - This will download the newest translations from Rosetta
4) `yarn build:prod`

To test other languages
===============
1) `yarn install`
2) `zat translate to_json -p src`
3) `zat translate update -p src` - This will download the newest translations from Rosetta
4) `yarn watch`
5) `zat server -p dist`

To run the tests
===============
1) `yarn install`
2) `zat translate to_json -p src`
3) `yarn karma start`
4) `yarn karma run` - In another terminal tab
