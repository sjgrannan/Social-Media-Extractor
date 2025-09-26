// manualLogin.js
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

export async function facebookManualLogin() {
  const platform = 'facebook';
  const loginUrls = {
    facebook: 'https://www.facebook.com/login',
  };

  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage();

  await page.goto(loginUrls[platform]);
  console.log('Please log in manually in the opened browser window...');

  const storagePath = path.resolve(`./facebook_cookies.json`);

  // Poll every 2 seconds to check if cookies are present
  while (true) {
    const cookies = await page.context().cookies();
    if (cookies.length > 0) {
      await page.context().storageState({ path: storagePath });
      console.log(`Saved cookies to ${storagePath}`);
      break;
    }
    await page.waitForTimeout(2000);
  }

  await browser.close();
}