const webpack = require('webpack');
const merge = require('webpack-merge');

const NPM_NAME = 'sails-hook-webpack';

module.exports = function (sails) {

  // Validate hook configuration
  if (!sails.config.webpack || !sails.config.webpack.options) {
    sails.log.warn(`${ NPM_NAME }: No webpack options have been defined.`);
    sails.log.warn(`${ NPM_NAME }: Please configure your config/webpack.js file.`);
    return {};
  }

  // Sails hook specification
  const hook = {
    emitReady: false,
    afterBuild: function(err, stats){
      if (err) return sails.log.error(`${ NPM_NAME }: Build error:\n`, err);
      // Emit events
      if (!this.emitReady) {
        sails.emit(`hook:${ NPM_NAME }:compiler-ready`, {});
        this.emitReady = true;
      }
      sails.emit(`hook:${ NPM_NAME }:after-build`, stats);
      // Display information, errors and warnings

      sails.log.info(`${ NPM_NAME }: Build complete.`);
      if (stats && stats.warnings && stats.warnings.length > 0) {
        sails.log.warn(`${ NPM_NAME }: Build warnings:\n`, stats.warnings);
      }
      if (stats && stats.errors && stats.errors.length > 0) {
        sails.log.error(`${ NPM_NAME }: Build errors:\n`, stats.errors);
      }
    }
  };

  const environment = process.env.NODE_ENV || 'development';
  const host = sails.getHost() || 'localhost';
  const port = sails.config.port || 1337;

  // Webpack options
  let options = sails.config.webpack.options;
  // Merge environment-specific options
  if (sails.config.webpack[environment]) {
    options = merge(options, sails.config.webpack[environment]);
  }
  // Merge default options
  options = merge(options, {
    plugins: [
      // User environment variables
      new webpack.DefinePlugin({
        'process.env': {
          'NODE_ENV': JSON.stringify(environment),
          'SAILS_HOST': JSON.stringify(host),
          'SAILS_PORT': JSON.stringify(port)
        }
      })
    ],
    performance: {
      hints: false
    },
    stats: 'errors-only'
  });

  // Create webpack compiler
  hook.compiler = webpack(options, (err, stats) => {
    if (err) {
      sails.log.error(`${ NPM_NAME }: Configuration error:\n`, err);
      return {};
    }
    sails.log.info(`${ NPM_NAME }: Webpack configured successfully.`);
    if (environment === 'production') {
      sails.log.info(`${ NPM_NAME }: Building for production...`);
      hook.compiler.run(hook.afterBuild.bind(hook));
    }
    else {
      sails.log.info(`${ NPM_NAME }: Watching for changes...`);
      hook.compiler.watch(options.watch, hook.afterBuild.bind(hook));
    }
  });

  // Start webpack-dev-server
  if (environment !== 'production' && sails.config.webpack.server) {
    const WebpackDevServer = require('webpack-dev-server');
    // Webpack-dev-server configuration
    let config = {
      hot: true,
      port: 3000
    };

    config = Object.assign(config, sails.config.webpack.server);

    // Listen on specific port
    hook.server = new WebpackDevServer(hook.compiler, config);
    hook.server.listen(config.port);
    sails.log.info(`${ NPM_NAME }: Webpack Dev Server listening on http://${host}: ${ config.port}`);
  }

  return hook;
};
