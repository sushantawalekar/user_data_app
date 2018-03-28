:warning: *Use of this software is subject to important terms and conditions as set forth in the License file* :warning:

Zendesk User Data App
===============

This is the [User Data App](https://www.zendesk.com/apps/user-data) for Zendesk. The App displays relevant information about the user and their ticket, fields and organizations

Setup
===============
Since a ZAF V2 app is free to implement its own system, we have tried several approaches and looked at how the [App scaffold](https://github.com/zendesk/app_scaffold) had merged different systems together. Personally I like simple system, and feel that the less files we have, the less magic is going on.

* dist/
  * An empty folder that needs *no* input from the developer. Point your ZAT server to this folder: `zat server -p dist/`
* spec/
  * All the (karma) specs sit in this folder.
* src/
  * The app itself that the developer will change.
* karma.conf.js
  * Karma config file
* package.json
* settings.yml
  * Default settings file for the app used by ZAT server
* translations-loader.js
  * Webpack loader that transforms the src/translations/*.json files into the dist/ folder
  * It has 2 roles: 1) move the *marketplace* translations into `dist/translations`. And 2) move the *app* translations into `bundle.js`
* webpack.config.js
* yarn.lock

Webpack
===============
Webpack is the builder that will transform the `src` directory into an `dist/` app suitable for browsers. The config can be quite confusing so we opted to keep it as simple as possible. The most confusing part is probably the css part. It uses a `sass-loader` to convert .scss into css, then `css-loader` to convert that into javascript (yah, that's webpack for you), and last `ExtractTextPlugin` to convert that javascript back into css and stick it into a `styles.css` file.

As seen in the `package.json` `yarn build:prod`, will run the end result through babel, because IE11 doesn't understand ES6 code, and webpack's `-p` options will minify the code.

Karma + Jasmine
===============
Karma is a test runner, Jasmine the test framework. In order to make this work we tell karma to compile the files first using webpack (with out webpack.config.js loaded in).
