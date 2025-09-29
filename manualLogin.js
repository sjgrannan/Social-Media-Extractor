import { chromium } from 'playwright';
import path from 'path';

export async function facebookManualLogin() {
  const browser = await chromium.launch({
    headless: false,
    args: ['--start-maximized']
  });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto('https://www.facebook.com/login', { waitUntil: 'networkidle' });

  // Wait for username input
  const usernameInput = page.locator('input[name="email"]');
  await usernameInput.waitFor({ state: 'visible', timeout: 15000 });

  // Wait for password input
  const passwordInput = page.locator('input[name="pass"]');
  await passwordInput.waitFor({ state: 'visible', timeout: 15000 });

  // Poll cookies until Facebook login is detected
  while (true) {
    const cookies = await context.cookies();
    const loggedIn = cookies.some(c => c.name === 'c_user');
    if (loggedIn) {
      const storagePath = path.resolve('./facebook_cookies.json');
      await context.storageState({ path: storagePath });
      console.log(`✅ Saved cookies to ${storagePath}`);
      break;
    }
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  await browser.close();
}

// Run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  facebookManualLogin();
}
