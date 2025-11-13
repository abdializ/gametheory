import type { NextConfig } from "next";
const path = require('path');

/** @type {import('next').NextConfig} */
const nextConfig: NextConfig = {
  // Allow WebSocket connections
  webpack: (config) => {
    config.externals.push({
      bufferutil: 'bufferutil',
      'utf-8-validate': 'utf-8-validate',
    });
    return config;
  },
};

module.exports = nextConfig;
