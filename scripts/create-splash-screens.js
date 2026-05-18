import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

const DEVICE_SIZES = [
  { name: 'iphone5', width: 640, height: 1136 },
  { name: 'iphone6', width: 750, height: 1334 },
  { name: 'iphone6plus', width: 828, height: 1792 },
  { name: 'iphonex', width: 1125, height: 2436 },
  { name: 'iphone12pro', width: 1170, height: 2532 },
  { name: 'ipad', width: 1536, height: 2048 }
];

async function getLogoBase64() {
  const logoPath = path.join(process.cwd(), 'public', 'assets', 'icons', 'logo6-rev.png');
  const logoBuffer = fs.readFileSync(logoPath);
  return logoBuffer.toString('base64');
}

async function createSplashScreens() {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();

  // Create output directory
  const outputDir = path.join(process.cwd(), 'public', 'assets', 'splash');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  try {
    for (const device of DEVICE_SIZES) {
      console.log(`Generating splash screen for ${device.name} (${device.width}x${device.height})...`);

      await page.setViewport({ width: device.width, height: device.height });

      // Create HTML content with WeebVIP branding
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');

            body {
              margin: 0;
              padding: 0;
              background: #111827;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              width: ${device.width}px;
              height: ${device.height}px;
              overflow: hidden;
              font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
            }

            .logo-container {
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
            }

            .logo-container img {
              width: 200px;
              height: 200px;
              object-fit: contain;
              filter: drop-shadow(0 10px 25px rgba(0, 0, 0, 0.3));
              margin-bottom: 32px;
            }

            .app-name {
              color: white;
              font-size: 48px;
              font-weight: 700;
              margin-bottom: 12px;
              letter-spacing: -1px;
              text-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
            }

            .app-tagline {
              color: #9ca3af;
              font-size: 20px;
              font-weight: 400;
              margin-bottom: 48px;
              text-align: center;
              max-width: 320px;
              line-height: 1.4;
            }

            @keyframes spin {
              from { transform: rotate(0deg); }
              to { transform: rotate(360deg); }
            }


            /* Responsive sizing for smaller devices */
            @media (max-width: 750px) {
              .logo-container img { width: 170px; height: 170px; }
              .app-name { font-size: 42px; }
              .app-tagline { font-size: 18px; max-width: 280px; }
            }

            @media (max-width: 640px) {
              .logo-container img { width: 150px; height: 150px; }
              .app-name { font-size: 38px; }
              .app-tagline { font-size: 16px; max-width: 260px; }
            }
          </style>
        </head>
        <body>
          <div class="logo-container">
            <img src="data:image/png;base64,${await getLogoBase64()}" alt="WeebVIP Logo">
            <h1 class="app-name">WeebVIP</h1>
            <p class="app-tagline">Track your anime watchlist</p>
          </div>
        </body>
        </html>
      `;

      await page.setContent(htmlContent);

      // Wait for fonts to load
      await page.waitForFunction(() => document.fonts.ready, { timeout: 3000 }).catch(() => {});

      // Take screenshot
      const filename = `splash-${device.width}x${device.height}.png`;
      await page.screenshot({
        path: path.join(outputDir, filename),
        width: device.width,
        height: device.height,
        type: 'png'
      });

      console.log(`✅ Generated ${filename}`);
    }

  } catch (error) {
    console.error('Error generating splash screens:', error);
  } finally {
    await browser.close();
  }
}

async function main() {
  await createSplashScreens();
  console.log('🎉 All splash screens generated successfully!');
}

main().catch(console.error);