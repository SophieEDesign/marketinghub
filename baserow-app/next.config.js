/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: [],
  },
  transpilePackages: ['@supabase/supabase-js', '@supabase/ssr'],
}

module.exports = nextConfig
