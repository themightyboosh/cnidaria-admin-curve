/** @type {import('next').NextConfig} */
const nextConfig = {
  // Mac optimizations
  experimental: {
    // Enable Turbopack for faster builds on Mac
    turbo: {
      rules: {
        '*.svg': {
          loaders: ['@svgr/webpack'],
          as: '*.js',
        },
      },
    },
  },
  
  // Optimize for Mac performance
  swcMinify: true,
  
  // Image optimization for Mac
  images: {
    domains: ['localhost'],
    formats: ['image/webp', 'image/avif'],
  },
  
  // Mac-specific optimizations
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production',
  },
  
  // Better Mac file watching
  webpack: (config, { dev, isServer }) => {
    if (dev && !isServer) {
      // Optimize for Mac development
      config.watchOptions = {
        poll: false,
        ignored: /node_modules/,
      };
    }
    return config;
  },
  
  // Port configuration
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:3000/api/:path*',
      },
    ];
  },
}

module.exports = nextConfig
