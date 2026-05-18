# E2E Testing Setup

## Playwright Configuration

This project uses Playwright for end-to-end testing with support for:
- Desktop browsers (Chrome, Firefox, Safari)
- Mobile device simulation
- Real iOS Simulator and Android Emulator testing

## Running Tests

### Basic Commands
```bash
# Run all tests
yarn test:e2e

# Run tests in headed mode (see browser)
yarn test:e2e --headed

# Run specific project
yarn test:e2e --project=mobile-chrome

# Run mobile tests only
yarn test:e2e tests/e2e/mobile.spec.ts
```

### Mobile Device Testing

#### Mobile Simulation (Default)
The configuration includes mobile device simulation for:
- iPhone 12 (Safari)
- Pixel 5 (Chrome)
- iPad Pro (Chrome)

#### Real iOS Simulator
To test on iOS Simulator:

1. **Setup iOS Simulator:**
   ```bash
   # Install Xcode and iOS Simulator
   xcode-select --install
   
   # Open iOS Simulator
   open -a Simulator
   ```

2. **Get your local IP address:**
   ```bash
   ipconfig getifaddr en0
   # Example output: 192.168.1.100
   ```

3. **Run tests with iOS Simulator:**
   ```bash
   # Set environment variables
   export IOS_SIMULATOR=true
   export IOS_BASE_URL=http://192.168.1.100:8080
   
   # Run tests
   yarn test:e2e --project=ios-simulator
   ```

#### Real Android Emulator
To test on Android Emulator:

1. **Setup Android Studio and Emulator:**
   ```bash
   # Install Android Studio from https://developer.android.com/studio
   # Create and start an Android Virtual Device (AVD)
   ```

2. **Run tests with Android Emulator:**
   ```bash
   # Set environment variables
   export ANDROID_EMULATOR=true
   export ANDROID_BASE_URL=http://10.0.2.2:8080
   
   # Run tests
   yarn test:e2e --project=android-emulator
   ```

## Test Structure

- `home.spec.ts` - Basic homepage functionality
- `anime-search.spec.ts` - Search and show detail tests
- `mobile.spec.ts` - Mobile-specific tests and responsive design

## Environment Variables

- `IOS_SIMULATOR=true` - Enable iOS Simulator testing
- `ANDROID_EMULATOR=true` - Enable Android Emulator testing
- `IOS_BASE_URL` - Base URL for iOS Simulator (your local IP)
- `ANDROID_BASE_URL` - Base URL for Android Emulator (usually http://10.0.2.2:8080)
- `MOBILE_BASE_URL` - Override base URL for mobile simulation

## Tips for Mobile Testing

1. **Network Access:**
   - For iOS Simulator: Use your machine's local IP address
   - For Android Emulator: Use `10.0.2.2` to access host machine
   - Make sure your dev server is running with `--host` flag

2. **Touch Interactions:**
   - Use `tap()` instead of `click()` for mobile
   - Test touch gestures and swipes where applicable

3. **Viewport Testing:**
   - Test different screen sizes and orientations
   - Verify responsive design works correctly

4. **Performance:**
   - Mobile tests may be slower than desktop
   - Consider network throttling for realistic conditions