import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import readline from 'readline';
import ffmpegPath from 'ffmpeg-static';
import ffmpeg from 'fluent-ffmpeg';
import ytDlp from 'yt-dlp-exec';
import { facebookManualLogin } from './manualLogin.js';

ffmpeg.setFfmpegPath(ffmpegPath);

function showHelp() {
  console.log('Supported platforms:');
  console.log('  - Instagram Reels (https://www.instagram.com/reel/ID)');
  console.log('  - Facebook Reels (https://www.facebook.com/reel/ID)');
  console.log('  - Reddit videos (https://www.reddit.com/... or https://v.redd.it/...)');
  console.log('  - YouTube Shorts (https://www.youtube.com/shorts/ID)');
  console.log('');
  console.log('Usage: node downloadSocialMedia.js <URL> [fps]');
}

function askQuestion(query) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(query, ans => { rl.close(); resolve(ans); }));
}

(async () => {
  let input = process.argv[2];
  if (input === '--help' || input === '-h') {
    showHelp();
    process.exit(0);
  }
  let fps = process.argv[3] ? parseInt(process.argv[3], 10) : 10;

  if (!input) {
    input = await askQuestion('Enter Reel/Video URL (see supported platforms with --help): ');
  }

  const outputDir = path.resolve('./frames');
  if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

  // Determine platform and reel ID
  let platform = '';
  let reelId = '';
  let contentUrl = '';

  if (input.includes('instagram.com/reel/')) {
    platform = 'instagram';
    const match = input.match(/reel\/([^\/\?]+)/);
    reelId = match ? match[1] : 'insta';
    contentUrl = input;
  } else if (input.includes('facebook.com/reel/')) {
    platform = 'facebook';
    const match = input.match(/reel\/([^\/\?]+)/);
    reelId = match ? match[1] : 'fb';
    contentUrl = input;
  } else if (input.includes('reddit.com') || input.includes('v.redd.it') || input.includes('.mp4')) {
    platform = 'reddit';
    reelId = 'reddit';
    contentUrl = input;
    var redditDirect = input.includes('.mp4');
  } else if (input.includes('youtube.com/shorts/')) {
    platform = 'youtube';
    const match = input.match(/shorts\/([^\/\?]+)/);
    reelId = match ? match[1] : 'ytshort';
    contentUrl = input;
  } else {
    console.error('Unsupported URL. Please provide Instagram, Facebook, Reddit, or YouTube Shorts URL.');
    process.exit(1);
  }

  if (platform === 'facebook') {
    const storageStatePath = path.resolve('./facebook_cookies.json');

    if (!fs.existsSync(storageStatePath)) {
      console.log('Cookies file not found. Launching manualLogin.js to generate cookies...');
      await facebookManualLogin();
      if (!fs.existsSync(storageStatePath)) {
        console.error('manualLogin.js did not generate Facebook cookies. Exiting.');
        process.exit(1);
      }
    }

    const browser = await chromium.launch({ headless: false });
    const context = await browser.newContext({ storageState: storageStatePath });
    const page = await context.newPage();

    console.log(`Navigating to Facebook Reel: ${contentUrl}`);
    try {
      await page.goto(contentUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await page.waitForSelector('video', { timeout: 10000 });
    } catch (err) {
      console.error('Failed to load Facebook Reel:', err.message);
      await browser.close();
      process.exit(1);
    }

    const videoUrl = await page.evaluate(() => {
      const videoEl = document.querySelector('video');
      return videoEl ? videoEl.src : null;
    });

    if (!videoUrl) {
      console.error('No MP4 video URL matching the Reel ID was captured. Exiting.');
      await browser.close();
      process.exit(1);
    }

    console.log(`Direct MP4 URL captured: ${videoUrl}`);
    const videoPath = path.join(outputDir, `facebook_${reelId}.mp4`);

    execSync(`curl -L "${videoUrl}" -o "${videoPath}"`, { stdio: 'inherit' });

    if (!fs.existsSync(videoPath) || fs.statSync(videoPath).size < 1000) {
      console.error('Downloaded video seems invalid. Exiting.');
      process.exit(1);
    }

    await new Promise((resolve, reject) => {
      ffmpeg(videoPath)
        .outputOptions([`-vf fps=${fps}`])
        .output(path.join(outputDir, 'frame_%04d.png'))
        .on('end', resolve)
        .on('error', reject)
        .run();
    });
    console.log('Frames extracted to', outputDir);
    await browser.close();

  } else if (platform === 'instagram') {
    console.log(`Downloading Instagram Reel: ${contentUrl}`);

    // Check if instaloader is installed
    try {
      execSync('instaloader --version', { stdio: 'ignore' });
    } catch {
      console.error('Instaloader is not installed. Please install it: pip install instaloader');
      process.exit(1);
    }

    const igVideoPath = path.join(outputDir, `instagram_${reelId}.mp4`);
    const igCommand = `instaloader --no-posts --no-profile-pic --no-captions --dirname-pattern="${outputDir}" --filename-pattern="instagram_${reelId}" -- -${reelId}`;

    try {
      execSync(igCommand, { stdio: 'inherit' });
    } catch (err) {
      console.error('Instagram download failed:', err.message);
      process.exit(1);
    }

    if (!fs.existsSync(igVideoPath)) {
      console.error('Instagram video not found after download. Exiting.');
      process.exit(1);
    }

    await new Promise((resolve, reject) => {
      ffmpeg(igVideoPath)
        .outputOptions([`-vf fps=${fps}`])
        .output(path.join(outputDir, 'frame_%04d.png'))
        .on('end', resolve)
        .on('error', reject)
        .run();
    });
    console.log('Frames extracted to', outputDir);
  } else if (platform === 'reddit') {
    if (redditDirect) {
      console.log(`Downloading Reddit direct mp4 video: ${contentUrl}`);
      const videoPath = path.join(outputDir, `reddit_${Date.now()}.mp4`);
      execSync(`curl -L "${contentUrl}" -o "${videoPath}"`, { stdio: 'inherit' });
      await new Promise((resolve, reject) => {
        ffmpeg(videoPath)
          .outputOptions([`-vf fps=${fps}`])
          .output(path.join(outputDir, 'frame_%04d.png'))
          .on('end', resolve)
          .on('error', reject)
          .run();
      });
      console.log('Frames extracted to', outputDir);
    } else {
      console.log(`Downloading Reddit video: ${contentUrl}`);
      const browser = await chromium.launch({ headless: false });
      const context = await browser.newContext();
      const page = await context.newPage();
      try {
        await page.goto(contentUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
        await page.waitForSelector('video', { timeout: 10000 });
      } catch (err) {
        console.error('Failed to load Reddit video:', err.message);
        await browser.close();
        process.exit(1);
      }
      const videoUrl = await page.evaluate(() => {
        const videoEl = document.querySelector('video');
        return videoEl ? videoEl.src : null;
      });
      if (!videoUrl) {
        console.error('Could not capture Reddit video URL. Exiting.');
        await browser.close();
        process.exit(1);
      }
      console.log(`Direct MP4 URL captured: ${videoUrl}`);
      const videoPath = path.join(outputDir, `reddit_${Date.now()}.mp4`);
      execSync(`curl -L "${videoUrl}" -o "${videoPath}"`, { stdio: 'inherit' });
      await new Promise((resolve, reject) => {
        ffmpeg(videoPath)
          .outputOptions([`-vf fps=${fps}`])
          .output(path.join(outputDir, 'frame_%04d.png'))
          .on('end', resolve)
          .on('error', reject)
          .run();
      });
      console.log('Frames extracted to', outputDir);
      await browser.close();
    }
  } else if (platform === 'youtube') {
    console.log(`Downloading YouTube Shorts: ${contentUrl}`);
    try {
      await ytDlp(contentUrl, {
        f: 'mp4',
        o: path.join(outputDir, `youtube_${reelId}.mp4`),
        verbose: true
      });
    } catch (err) {
      console.error('YouTube Shorts download failed:', err.message);
      process.exit(1);
    }
    const ytVideoPath = path.join(outputDir, `youtube_${reelId}.mp4`);
    if (!fs.existsSync(ytVideoPath)) {
      console.error('YouTube video not found after download. Exiting.');
      process.exit(1);
    }
    await new Promise((resolve, reject) => {
      ffmpeg(ytVideoPath)
        .outputOptions([`-vf fps=${fps}`])
        .output(path.join(outputDir, 'frame_%04d.png'))
        .on('end', resolve)
        .on('error', reject)
        .run();
    });
    console.log('Frames extracted to', outputDir);
  }
})();
