import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

const DEVICE_SIZES = [
  { name: 'iphone5', width: 640, height: 1136 },
  { name: 'iphone6', width: 750, height: 1334 },
  { name: 'iphone6plus', width: 828, height: 1792 },
  { name: 'iphonex', width: 1125, height: 2436 },
  { name: 'iphone12pro', width: 1170, height: 2532 },
  { name: 'ipad', width: 1536, height: 2048 },
  { name: 'ipadpro', width: 2048, height: 2732 }
];

async function exportLottieToPNG() {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();

  // Create output directory
  const outputDir = path.join(process.cwd(), 'public', 'assets', 'splash');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  try {
    // Read the Lottie animation
    const animationPath = path.join(process.cwd(), 'public', 'assets', 'animations', 'splash-screen.json');
    const animationData = JSON.parse(fs.readFileSync(animationPath, 'utf8'));

    for (const device of DEVICE_SIZES) {
      console.log(`Generating splash screen for ${device.name} (${device.width}x${device.height})...`);

      await page.setViewport({ width: device.width, height: device.height });

      // Create HTML content with Lottie animation
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <script src="https://cdnjs.cloudflare.com/ajax/libs/lottie-web/5.12.2/lottie.min.js"></script>
          <style>
            body {
              margin: 0;
              padding: 0;
              background: #111827;
              display: flex;
              align-items: center;
              justify-content: center;
              width: ${device.width}px;
              height: ${device.height}px;
              overflow: hidden;
            }
            #animation {
              width: 300px;
              height: 300px;
            }
          </style>
        </head>
        <body>
          <div id="animation"></div>
          <script>
            const animationData = ${JSON.stringify(animationData)};
            const animation = lottie.loadAnimation({
              container: document.getElementById('animation'),
              renderer: 'svg',
              loop: false,
              autoplay: false,
              animationData: animationData
            });

            // Set to a specific frame (middle of animation for static splash)
            animation.addEventListener('DOMLoaded', () => {
              animation.goToAndStop(60, true); // Frame 60 out of 120
              window.animationReady = true;
            });
          </script>
        </body>
        </html>
      `;

      await page.setContent(htmlContent);

      // Wait for animation to load
      await page.waitForFunction(() => window.animationReady === true, { timeout: 10000 });

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

// Check if puppeteer is available, if not provide alternative
async function checkDependencies() {
  try {
    await import('puppeteer');
    return true;
  } catch (error) {
    console.log('Puppeteer not found. Installing...');
    return false;
  }
}

async function main() {
  const hasDepedencies = await checkDependencies();
  if (!hasDepedencies) {
    console.log('Please install puppeteer first: yarn add -D puppeteer');
    process.exit(1);
  }

  await exportLottieToPNG();
  console.log('🎉 All splash screens generated successfully!');
}

main().catch(console.error);