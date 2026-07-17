/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "drive.google.com" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
    ],
  },
  async redirects() {
    return [
      { source: "/app/social", destination: "/app/content", permanent: false },
      { source: "/app/media", destination: "/app/library", permanent: false },
      { source: "/app/brand", destination: "/app/library", permanent: false },
      {
        source: "/app/resources",
        destination: "/app/library",
        permanent: false,
      },
      { source: "/app/merch", destination: "/app/internal", permanent: false },
      {
        source: "/app/sponsorships",
        destination: "/app/partners",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
