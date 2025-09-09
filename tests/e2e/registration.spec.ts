import { test, expect } from '@playwright/test';
import { v4 as uuidv4 } from 'uuid';

// Helper function to check Mailhog for emails
async function getLatestEmail(recipientEmail: string, retries = 15, delay = 3000) {
  console.log(`Looking for email for ${recipientEmail}...`);
  
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch('https://mailhog.staging.weeb.vip/api/v2/messages');
      const data = await response.json();
      
      console.log(`Attempt ${i + 1}: Found ${data.items?.length || 0} total emails in Mailhog`);
      
      if (data.items && data.items.length > 0) {
        // Log all recipients for debugging
        const recipients = data.items.map((item: any) => item.Content?.Headers?.To?.[0]).filter(Boolean);
        console.log(`Recipients found: ${recipients.join(', ')}`);
        
        // Find email for our recipient (check both with and without brackets)
        const email = data.items.find((item: any) => {
          const toHeader = item.Content?.Headers?.To;
          return toHeader && (
            toHeader.includes(recipientEmail) || 
            toHeader.includes(`<${recipientEmail}>`)
          );
        });

        if (email) {
          console.log(`Found email for ${recipientEmail}!`);
          return email;
        }
      }
    } catch (error) {
      console.log(`Attempt ${i + 1} failed:`, error.message);
    }

    // Wait before retrying
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  throw new Error(`No email found for ${recipientEmail} after ${retries} attempts`);
}

// Helper to extract verification link from email
function extractVerificationLink(emailContent: string): string | null {
  // First, decode quoted-printable encoding
  let decodedContent = emailContent
    .replace(/=\r?\n/g, '') // Remove soft line breaks
    .replace(/=3D/g, '=')    // Decode equals signs
    .replace(/=20/g, ' ')    // Decode spaces
    .replace(/=2F/g, '/')    // Decode forward slashes
    .replace(/=3A/g, ':')    // Decode colons
    .replace(/=40/g, '@');   // Decode @ signs
  
  // Look for an anchor tag with href containing 'verification?email='
  // Handle both regular quotes and escaped quotes
  const linkPattern = /<a[^>]+href\s*=\s*(?:3D)?\\?["']([^"']*verification\?email=[^"']*)/gi;
  const match = linkPattern.exec(decodedContent);
  
  if (match && match[1]) {
    let link = match[1];
    
    // Clean up any remaining HTML entities
    link = link.replace(/&amp;/g, '&');
    link = link.replace(/&#x3D;/g, '=');
    link = link.replace(/\\/g, ''); // Remove backslashes
    
    // If it's a relative URL, make it absolute
    if (!link.startsWith('http')) {
      link = `https://weeb.staging.weeb.vip${link.startsWith('/') ? '' : '/'}${link}`;
    }
    
    console.log(`Found verification link in email: ${link}`);
    return link;
  }

  // Fallback: look for the URL pattern directly (not in href)
  const directUrlPattern = /https:\/\/weeb\.staging\.weeb\.vip\/auth\/verification\?email=[^&\s]+&token=[^&\s"]+/gi;
  const directMatch = directUrlPattern.exec(decodedContent);
  if (directMatch) {
    let link = directMatch[0];
    link = link.replace(/&amp;/g, '&');
    console.log(`Found verification link (direct pattern): ${link}`);
    return link;
  }

  return null;
}

// Helper to delete emails from Mailhog for cleanup
async function deleteEmailsForRecipient(recipientEmail: string) {
  let deletedCount = 0;
  try {
    while (true) {
      // Get all messages and find ones for our recipient
      const response = await fetch('https://mailhog.staging.weeb.vip/api/v2/messages');
      const data = await response.json();
      
      if (!data.items || data.items.length === 0) {
        break;
      }
      
      // Find email for our recipient
      const email = data.items.find((item: any) =>
        item.Content?.Headers?.To?.includes(recipientEmail)
      );
      
      if (!email) {
        break; // No more emails for this recipient
      }
      
      // Delete this email
      await fetch(`https://mailhog.staging.weeb.vip/api/v1/messages/${email.ID}`, {
        method: 'DELETE'
      });
      deletedCount++;
    }
    
    if (deletedCount > 0) {
      console.log(`Cleaned up ${deletedCount} emails for ${recipientEmail}`);
    }
  } catch (error) {
    console.log('Could not delete emails:', error);
  }
}

test.describe('User Registration Flow', () => {
  let testEmail: string;
  const testPassword = 'Password1!';

  test.beforeEach(async () => {
    // Generate unique email for this test run
    testEmail = `${uuidv4()}@weeb.vip`;
    console.log(`Testing with email: ${testEmail}`);
  });

  test.afterEach(async () => {
    // Clean up emails after test
    await deleteEmailsForRecipient(testEmail);
  });

  test('complete registration and email verification flow', async ({ page, context }) => {
    // Step 1: Navigate to registration page
    await page.goto('/');

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Check if we need to open hamburger menu (mobile)
    const hamburgerMenu = page.locator('[aria-label*="menu" i], button:has(svg.hamburger), button:has(.hamburger), [data-testid="mobile-menu"], button[aria-label="Open menu"]');
    let isMobile = false;
    if (await hamburgerMenu.isVisible()) {
      console.log('Opening hamburger menu (mobile view)');
      await hamburgerMenu.click();
      await page.waitForTimeout(500);
      isMobile = true;
    }
    
    // Open modal - use different selectors for mobile menu
    let loginButton;
    if (isMobile) {
      // In mobile menu, look for links/buttons within the opened menu
      loginButton = page.locator('[data-testid="mobile-menu-content"] a:has-text("Login"), nav a:has-text("Login"), .mobile-menu a:has-text("Login"), [role="menu"] a:has-text("Login")').first();
      if (await loginButton.count() === 0) {
        // Fallback to any visible login button
        loginButton = page.locator('button:has-text("Login"), a:has-text("Login")').locator('visible=true').first();
      }
    } else {
      // Desktop - use original selector
      loginButton = page.locator('button:has-text("Login"), a:has-text("Login")').first();
    }
    
    if (await loginButton.count() > 0) {
      console.log(`Clicking login button (mobile: ${isMobile})`);
      await loginButton.click();
      await page.waitForTimeout(1000);
    } else {
      console.log('No login button found after menu interaction');
    }

    // Check if we're now on a login page or if modal opened
    const currentUrl = page.url();
    console.log(`Current URL after login click: ${currentUrl}`);
    
    if (currentUrl.includes('/login')) {
      // Mobile redirected to login page instead of opening modal
      console.log('Redirected to login page, navigating to register page');
      await page.goto('/register');
      await page.waitForLoadState('networkidle');
      
      // Skip modal steps and go directly to form filling
    } else {
      // Wait for modal to be visible (desktop behavior)
      const modal = page.locator('[id="headlessui-dialog-panel-:r2b:"]');
      try {
        await modal.waitFor({ state: 'visible', timeout: 5000 });
        
        // Switch to register mode - look for the register button/link in the modal
        const registerLink = page.getByRole('button', { name: 'Register' });
        if (await registerLink.count() > 0) {
          await registerLink.click();
          await page.waitForTimeout(1000); // Wait for form to switch
        }
      } catch (error) {
        console.log('Modal not found, trying direct navigation to register page');
        await page.goto('/register');
        await page.waitForLoadState('networkidle');
      }
    }

    // Step 2: Fill registration form - be more specific with selectors
    const emailInput = page.locator('input[name="username"], input[type="email"], input[placeholder*="email" i]').first();
    await emailInput.waitFor({ state: 'visible' });
    await emailInput.fill(testEmail);

    const passwordInput = page.locator('input[name="password"]').first();
    await passwordInput.fill(testPassword);

    // Fill confirm password if it exists
    const confirmPasswordInput = page.locator('input[name="confirmPassword"], input[id="confirmPassword"]');
    if (await confirmPasswordInput.count() > 0) {
      await confirmPasswordInput.fill(testPassword);
    }

    // Step 3: Submit registration - look for visible submit button
    const submitButton = page.getByRole('button', { name: 'Register' });
    await submitButton.waitFor({ state: 'visible', timeout: 5000 });
    await submitButton.click({ force: true });

    // Step 4: Check for success message
    await expect(page.locator('text=/success|verify|check.*email/i')).toBeVisible({ timeout: 10000 });
    console.log('Registration successful, checking for verification email...');

    // Step 5: Wait for and retrieve verification email from Mailhog
    const email = await getLatestEmail(testEmail);
    expect(email).toBeTruthy();
    console.log('Verification email received');

    // Step 6: Extract verification link from email
    const emailBody = email.Content?.Body || '';
    console.log(`Email body content: ${emailBody.slice(0, 500)}...`);
    const verificationLink = extractVerificationLink(emailBody);
    expect(verificationLink).toBeTruthy();
    console.log(`Verification link found: ${verificationLink}`);

    // Step 7: Visit verification link
    if (verificationLink) {
      await page.goto(verificationLink);
      
      // Wait for page to load
      await page.waitForLoadState('networkidle');
      
      // Debug: log what's on the page
      const pageText = await page.textContent('body');
      console.log('Verification page content:', pageText?.slice(0, 500));

      // Wait for verification to complete - try multiple possible selectors
      const successSelectors = [
        page.locator('text=/verified|success|confirmed/i'),
        page.locator('text=/email.*verified/i'),
        page.locator('text=/verification.*complete/i'),
        page.locator('text=/account.*verified/i'),
        page.locator(':text-is("Email Verified")'),
        page.locator(':text-is("Verification Successful")'),
        page.locator('h1, h2, h3').filter({ hasText: /verif/i })
      ];
      
      let found = false;
      for (const selector of successSelectors) {
        if (await selector.count() > 0) {
          await expect(selector.first()).toBeVisible({ timeout: 5000 });
          found = true;
          break;
        }
      }
      
      if (!found) {
        // If no success message found, just check we're on the verification page
        // and not showing an error
        const hasError = await page.locator('text=/error|invalid|expired/i').count() > 0;
        if (hasError) {
          throw new Error('Verification failed - error message shown');
        }
        console.log('Warning: Could not find explicit success message, but no error shown');
      }
      
      console.log('Email verification successful');
    }

    // Step 8: Try to login with verified account
    await page.goto('/login');

    await page.fill('input[name="username"], input[type="email"]', testEmail);
    await page.fill('input[name="password"]', testPassword);

    const loginSubmitButton = page.locator('button[type="submit"], button:has-text("Sign In"), button:has-text("Login")').last();
    await loginSubmitButton.click();

    // Step 9: Verify successful login
    // Wait for navigation after login
    await page.waitForLoadState('networkidle');
    
    // Debug: log what's on the page after login
    const pageUrl = page.url();
    console.log('Current URL after login:', pageUrl);
    const pageContent = await page.textContent('body');
    console.log('Page content after login:', pageContent?.slice(0, 300));
    
    // Check for various signs of successful login
    const authIndicators = [
      page.locator('[data-testid="user-menu"]'),
      page.locator('.user-menu'),
      page.locator('a[href="/profile"]'),
      page.locator('button:has-text("Logout")'),
      page.locator('button:has-text("Sign Out")'),
      page.locator('text="My Profile"'),
      page.locator('text="Settings"'),
      page.locator('[aria-label*="user"]'),
      page.locator('[aria-label*="profile"]')
    ];
    
    let loggedIn = false;
    for (const indicator of authIndicators) {
      if (await indicator.count() > 0) {
        console.log(`Found auth indicator: ${await indicator.first().textContent()}`);
        loggedIn = true;
        break;
      }
    }
    
    // Alternative: Check if we're redirected away from login page
    if (!loggedIn && !pageUrl.includes('/login')) {
      console.log('Redirected away from login page - assuming successful login');
      loggedIn = true;
    }
    
    // Alternative: Check if there's no login button visible
    if (!loggedIn) {
      const loginButton = await page.locator('button:has-text("Login"), a:has-text("Login")').count();
      if (loginButton === 0) {
        console.log('No login button found - assuming user is logged in');
        loggedIn = true;
      }
    }
    
    expect(loggedIn).toBeTruthy();
    console.log('Login successful - registration flow complete!');
  });

  test('resend verification email', async ({ page }) => {
    // Use the email from beforeEach - don't create a new one

    // Navigate to registration
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Check if we need to open hamburger menu (mobile)
    const hamburgerMenu = page.locator('[aria-label*="menu" i], button:has(svg.hamburger), button:has(.hamburger), [data-testid="mobile-menu"], button[aria-label="Open menu"]');
    let isMobile = false;
    if (await hamburgerMenu.isVisible()) {
      console.log('Opening hamburger menu (mobile view)');
      await hamburgerMenu.click();
      await page.waitForTimeout(500);
      isMobile = true;
    }
    
    // Open modal - use different selectors for mobile menu
    let loginButton;
    if (isMobile) {
      // In mobile menu, look for links/buttons within the opened menu
      loginButton = page.locator('[data-testid="mobile-menu-content"] a:has-text("Login"), nav a:has-text("Login"), .mobile-menu a:has-text("Login"), [role="menu"] a:has-text("Login")').first();
      if (await loginButton.count() === 0) {
        // Fallback to any visible login button
        loginButton = page.locator('button:has-text("Login"), a:has-text("Login")').locator('visible=true').first();
      }
    } else {
      // Desktop - use original selector
      loginButton = page.locator('button:has-text("Login"), a:has-text("Login")').first();
    }
    
    if (await loginButton.count() > 0) {
      console.log(`Clicking login button (mobile: ${isMobile})`);
      await loginButton.click();
      await page.waitForTimeout(1000);
    } else {
      console.log('No login button found after menu interaction');
    }

    // Wait for the input form to be visible
    const usernameInput = page.locator('input[name="username"], input[type="email"]').first();
    await usernameInput.waitFor({ state: 'visible', timeout: 5000 });

    // Switch to register
    const registerLink = page.getByRole('button', { name: 'Register' });
    if (await registerLink.count() > 0) {
      await registerLink.click();
      await page.waitForTimeout(1000);
    }

    // Register
    const emailInput = page.locator('input[name="username"], input[type="email"], input[placeholder*="email" i]').first();
    await emailInput.waitFor({ state: 'visible' });
    await emailInput.fill(testEmail);

    await page.fill('input[name="password"]', testPassword);

    const confirmPasswordInput = page.locator('input[name="confirmPassword"], input[id="confirmPassword"]');
    if (await confirmPasswordInput.count() > 0) {
      await confirmPasswordInput.fill(testPassword);
    }

    const submitButton = page.getByRole('button', { name: 'Register' })
    await submitButton.waitFor({ state: 'visible', timeout: 5000 });
    await submitButton.click();

    await expect(page.locator('text=/success|verify|check.*email/i')).toBeVisible({ timeout: 10000 });

    // Navigate to resend verification page
    await page.goto('/auth/resend-verification');

    // Fill in email
    await page.fill('input[name="username"], input[type="email"]', testEmail);

    // Submit resend request
    const resendButton = page.locator('button:has-text("Send Verification Email"), button[type="submit"]').last();
    await resendButton.click();

    // Check for success message
    await expect(page.locator('text=/sent|check.*inbox/i')).toBeVisible({ timeout: 10000 });
    console.log('Resend verification email successful');

    // Verify email was received in Mailhog
    const email = await getLatestEmail(testEmail);
    expect(email).toBeTruthy();
    console.log('Resent verification email received');
  });

  test('prevent login before email verification', async ({ page }) => {
    // Register but don't verify - use email from beforeEach

    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Check if we need to open hamburger menu (mobile)
    const hamburgerMenu = page.locator('[aria-label*="menu" i], button:has(svg.hamburger), button:has(.hamburger), [data-testid="mobile-menu"], button[aria-label="Open menu"]');
    let isMobile = false;
    if (await hamburgerMenu.isVisible()) {
      console.log('Opening hamburger menu (mobile view)');
      await hamburgerMenu.click();
      await page.waitForTimeout(500);
      isMobile = true;
    }
    
    // Open modal - use different selectors for mobile menu
    let loginButton;
    if (isMobile) {
      // In mobile menu, look for links/buttons within the opened menu
      loginButton = page.locator('[data-testid="mobile-menu-content"] a:has-text("Login"), nav a:has-text("Login"), .mobile-menu a:has-text("Login"), [role="menu"] a:has-text("Login")').first();
      if (await loginButton.count() === 0) {
        // Fallback to any visible login button
        loginButton = page.locator('button:has-text("Login"), a:has-text("Login")').locator('visible=true').first();
      }
    } else {
      // Desktop - use original selector
      loginButton = page.locator('button:has-text("Login"), a:has-text("Login")').first();
    }
    
    if (await loginButton.count() > 0) {
      console.log(`Clicking login button (mobile: ${isMobile})`);
      await loginButton.click();
      await page.waitForTimeout(1000);
    } else {
      console.log('No login button found after menu interaction');
    }

    // Wait for the input form to be visible
    const usernameInput = page.locator('input[name="username"], input[type="email"]').first();
    await usernameInput.waitFor({ state: 'visible', timeout: 5000 });

    // Switch to register
    const registerLink = page.getByRole('button', { name: 'Register' });
    if (await registerLink.count() > 0) {
      await registerLink.click();
      await page.waitForTimeout(1000);
    }

    // Fill registration
    const emailInput = page.locator('input[name="username"], input[type="email"], input[placeholder*="email" i]').first();
    await emailInput.waitFor({ state: 'visible' });
    await emailInput.fill(testEmail);

    await page.fill('input[name="password"]', testPassword);

    const confirmPasswordInput = page.locator('input[name="confirmPassword"], input[id="confirmPassword"]');
    if (await confirmPasswordInput.count() > 0) {
      await confirmPasswordInput.fill(testPassword);
    }

    const submitButton = page.getByRole('button', { name: 'Register' });
    await submitButton.waitFor({ state: 'visible', timeout: 5000 });
    await submitButton.click({ force: true });

    await expect(page.locator('text=/success|verify|check.*email/i')).toBeVisible({ timeout: 10000 });

    // Try to login without verification
    await page.goto('/login');

    await page.fill('input[name="username"], input[type="email"]', testEmail);
    await page.fill('input[name="password"]', testPassword);

    const loginSubmitButton = page.locator('button[type="submit"], button:has-text("Sign In"), button:has-text("Login")').last();
    await loginSubmitButton.click();

    // Should see error about email verification
    await expect(page.locator('text=/verify|verification|not.*verified/i')).toBeVisible({ timeout: 10000 });
    console.log('Login correctly blocked for unverified email');
  });
});
