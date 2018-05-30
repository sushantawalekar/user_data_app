:warning: *Use of this software is subject to important terms and conditions as set forth in the License file* :warning:

Zendesk User Data App
===============

This is the [User Data App](https://www.zendesk.com/apps/user-data) for Zendesk. The App displays relevant information about the user and their ticket, fields and organizations.

Setup
===============
Since a ZAF V2 app is free to implement its own system, we have tried several approaches and looked at how the [App scaffold](https://github.com/zendesk/app_scaffold) had merged different systems together.

* dist/
  * An empty folder that needs *no* input from the developer. It's contents comes from webpack. Point your ZAT server to this folder: `zat server -p dist/`.
* spec/
  * The (mocha with karma on Chrome) specs in this folder test the `src/javascript/` files. These test run in ChromeHeadless as defined by `karma.conf.js`.
* src/
  * The app itself that the developer will change.
* test/
  * All the (mocha on node) specs sit in this folder. Currently it only tests the `webpack/` files.
* webpack/
  * translations-loader.js - Renders translations (`src/translations/*.json`) into a single object with key-values and puts that into the `bundle.js`.
  * translations-plugin.js - Copies the *marketplace* translations (`src/translations/*.json`) into the `dist/translations` folder.
* karma.conf.js - Karma config file.
* package-lock.json
* package.json
* settings.yml - Settings file for the app used by ZAT server.
* webpack.config.js

Webpack
===============
Webpack is the builder that will transform the `src` directory into an `dist/` app suitable for browsers. The config can be quite confusing so we opted to keep it as simple as possible. The most confusing part is probably the css part. It uses a `sass-loader` to convert .scss into css, then `css-loader` to convert that into javascript, and last `ExtractTextPlugin` to convert that javascript back into css and stick it into a `styles.css` file.

For development run either a single run `npm run build:dev` or keep watching the files with `npm run watch`. For production `npm run build` will run the end result through babel, because IE11 doesn't understand ES6 code, and webpack's `-p` options will minify the code.

Karma + Mocha => Chrome
===============
Karma is a test runner, Mocha the test framework. In order to make this work we tell karma to compile the files first using webpack (with out webpack.config.js loaded in).

Mocha => Node
===============
Mocha on Node will run the mocha (`test/`) tests.
