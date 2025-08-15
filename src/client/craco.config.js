module.exports = {
  webpack: {
    configure: (webpackConfig, { env }) => {
      // Optimize for development
      if (env === "development") {
        // Enable faster hot reloading
        webpackConfig.optimization = {
          ...webpackConfig.optimization,
          removeAvailableModules: false,
          removeEmptyChunks: false,
          splitChunks: false,
        };

        // Improve hot reloading performance
        webpackConfig.watchOptions = {
          poll: 1000,
          aggregateTimeout: 300,
          ignored: /node_modules/,
        };
      }

      return webpackConfig;
    },
  },
  devServer: {
    hot: true,
    liveReload: true,
    watchFiles: ["src/**/*"],
    client: {
      overlay: {
        errors: true,
        warnings: false,
      },
    },
  },
};
