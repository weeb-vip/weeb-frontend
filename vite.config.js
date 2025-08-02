import {defineConfig} from 'vite'
import react from '@vitejs/plugin-react'
import {viteStaticCopy} from 'vite-plugin-static-copy'
import * as dotenv from 'dotenv'

dotenv.config()

// https://vitejs.dev/config/

const configName = process.env.APP_CONFIG || process.env.NODE_ENV || 'development'
export default defineConfig({
    define: {
        global: 'window',
    },


    build: {
        target: ['es2018', 'safari11'], // or 'es2015' for broadest support
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
