/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',

  async rewrites() {
    const backend =
      process.env.BACKEND_API_URL ??
      'http://127.0.0.1:3008'

    return [
      {
        source: '/crm/:path*',
        destination: `${backend}/crm/:path*`,
      },
      {
        source: '/eskiz/:path*',
        destination: 'https://notify.eskiz.uz/api/:path*',
      },
    ]
  },
}

module.exports = nextConfig