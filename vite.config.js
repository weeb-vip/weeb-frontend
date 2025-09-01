import {defineConfig} from 'vite'
import react from '@vitejs/plugin-react'
import {viteStaticCopy} from 'vite-plugin-static-copy'
import {VitePWA} from 'vite-plugin-pwa'
import * as dotenv from 'dotenv'

dotenv.config()

// https://vitejs.dev/config/

const configName = process.env.APP_CONFIG || process.env.NODE_ENV || 'development'
export default defineConfig({
    define: {
        global: 'window',
        __APP_VERSION__: JSON.stringify(process.env.VITE_APP_VERSION || 'dev'),
    },


    build: {
        target: ['es2020', 'safari14'], // Updated targets for better performance
        rollupOptions: {
            output: {
                entryFileNames: 'assets/[name]-[hash].js',
                chunkFileNames: 'assets/[name]-[hash].js',
                assetFileNames: (assetInfo) => {
                    // Force worker files to have .js extension
                    if (assetInfo.name && assetInfo.name.includes('worker')) {
                        return 'assets/[name]-[hash].js';
                    }
                    return 'assets/[name]-[hash].[ext]';
                },
                manualChunks: {
                    // Critical vendor chunks
                    'react-vendor': ['react', 'react-dom'],
                    'router': ['react-router-dom'],
                    'query': ['@tanstack/react-query'],
                    'ui': ['@headlessui/react', '@fortawesome/react-fontawesome', '@fortawesome/fontawesome-svg-core'],
                    'apollo': ['@apollo/client', 'graphql'],
                    'utils': ['date-fns', 'he', 'query-string'],
                    // Separate chunks for heavy imports
                    'motion': ['motion'],
                    'flagsmith': ['flagsmith']
                }
            }
        },
        // Enable modern features
        cssCodeSplit: true,
        assetsInlineLimit: 4096,
        // Improve build performance
        terserOptions: {
            compress: {
                drop_console: true,
                drop_debugger: true
            }
        }
    },
    worker: {
        format: 'es',
        plugins: [
            // Ensure TypeScript compilation for workers
        ],
        rollupOptions: {
            external: [],
            output: {
                entryFileNames: 'assets/[name]-[hash].js',
                chunkFileNames: 'assets/[name]-[hash].js',
                assetFileNames: 'assets/[name]-[hash].js'
            }
        }
    },
    plugins: [
        viteStaticCopy({
            targets: [
                {
                    src: `src/config/static/${configName}/index.json`,
                    dest: 'config.json',
                    rename: (fileName,
                             fileExtension,
                             fullPath) => {
                        return '../config.json'
                    }
                }
            ]
        }),
        react(),
        VitePWA({
            registerType: 'autoUpdate',
            includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
            useCredentials: true,
            workbox: {
                globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
                runtimeCaching: [
                    {
                        urlPattern: /^https:\/\/weeb-api\.staging\.weeb\.vip\/.*$/,
                        handler: 'NetworkFirst',
                        options: {
                            cacheName: 'api-cache',
                            expiration: {
                                maxEntries: 100,
                                maxAgeSeconds: 60 * 5 // 5 minutes
                            },
                            networkTimeoutSeconds: 10
                        }
                    },
                    {
                        urlPattern: /^https:\/\/gateway\.staging\.weeb\.vip\/graphql$/,
                        handler: 'NetworkFirst',
                        options: {
                            cacheName: 'graphql-cache',
                            expiration: {
                                maxEntries: 50,
                                maxAgeSeconds: 60 * 2 // 2 minutes
                            },
                            networkTimeoutSeconds: 8
                        }
                    },
                    {
                        urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/,
                        handler: 'CacheFirst',
                        options: {
                            cacheName: 'images-cache',
                            expiration: {
                                maxEntries: 200,
                                maxAgeSeconds: 60 * 60 * 24 * 7 // 1 week
                            }
                        }
                    }
                ]
            },
            manifest: {
                name: 'WeebVIP',
                short_name: 'WeebVIP',
                description: 'Track your anime watchlist',
                icons: [
                    {
                        src: '/assets/icons/logo6-rev-sm_sm.png',
                        sizes: '192x192',
                        type: 'image/png',
                        purpose: 'any maskable'
                    },
                    {
                        src: '/assets/icons/logo6-rev-sm_sm.png',
                        sizes: '512x512',
                        type: 'image/png',
                        purpose: 'any maskable'
                    }
                ],
                start_url: '/',
                display: 'standalone',
                theme_color: '#ffffff',
                background_color: '#ffffff',
                orientation: 'portrait-primary',
                scope: '/',
                categories: ['entertainment', 'lifestyle']
            }
        })
    ],
    server: {
        host: '0.0.0.0',
        port: 8083,
        proxy: {
            "/config.json": {
                target: "http://localhost:8083",
                changeOrigin: true,
                rewrite: (path) => `src/config/static/${configName}/index.json`,
            },
        },
    },
    assetsInclude: [`./src/config/static/${configName}/index.json`],
})
