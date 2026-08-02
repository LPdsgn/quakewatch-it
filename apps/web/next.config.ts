import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
	transpilePackages: ['@quakewatch/core', '@quakewatch/tokens'],
	allowedDevOrigins: ['192.168.*.*', '10.*.*.*', 'localhost'],
}

export default nextConfig
