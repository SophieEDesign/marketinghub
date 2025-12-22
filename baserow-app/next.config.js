/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: [],
  },
  transpilePackages: ['@supabase/supabase-js', '@supabase/ssr'],
  webpack: (config, { isServer }) => {
    // Fix for Supabase ESM module resolution
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      }
    }
    
    // Handle .mjs files
    config.module.rules.push({
      test: /\.mjs$/,
      include: /node_modules/,
      type: 'javascript/auto',
      resolve: {
        fullySpecified: false,
      },
    })
    
    // Prevent webpack from trying to resolve @radix-ui/react-alert-dialog
    // by aliasing it to our shim file
    const path = require('path')
    config.resolve.alias = {
      ...config.resolve.alias,
      '@radix-ui/react-alert-dialog': path.resolve(__dirname, 'components/ui/alert-dialog.tsx'),
    }
    
    return config
  },
}

module.exports = nextConfig
