import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
	transpilePackages: ['@quakewatch/core', '@quakewatch/tokens'],
}

export default nextConfig
