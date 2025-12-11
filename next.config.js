const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack: (config, { isServer }) => {
    // Make recharts optional - alias to stub module if not installed
    if (!isServer) {
      try {
        require.resolve('recharts');
        // recharts is installed, use it normally
      } catch (e) {
        // recharts not installed - alias to stub module to prevent build errors
        config.resolve.alias = config.resolve.alias || {};
        config.resolve.alias['recharts'] = path.resolve(__dirname, 'lib/webpack/recharts-stub.js');
      }
    }
    return config;
  },
}

module.exports = nextConfig

