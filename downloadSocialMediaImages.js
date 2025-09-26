/**
 * Script to download images from Instagram, Facebook, Reddit, and YouTube posts.
 * - Prompts for a URL if not provided via CLI.
 * - Detects platform.
 * - Uses instaloader for Instagram.
 * - Uses Playwright for Facebook, Reddit, YouTube.
 * - Downloads images to images/ folder.
 */

import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { exec } from 'child_process';
import { chromium } from 'playwright';
import fetch from 'node-fetch';

import { fileURLToPath } from 'url';

import { facebookManualLogin } from './manualLogin.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to prompt for input
function prompt(question) {
    return new Promise((resolve) => {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
        });
        rl.question(question, (answer) => {
            rl.close();
            resolve(answer);
        });
    });
}

// Helper to download an image from URL
async function downloadImage(url, destFolder, filename) {
    try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Failed to fetch image: ${url}`);
        const destPath = path.join(destFolder, filename);
        const fileStream = fs.createWriteStream(destPath);
        await new Promise((resolve, reject) => {
            res.body.pipe(fileStream);
            res.body.on('error', reject);
            fileStream.on('finish', resolve);
        });
        console.log(`Downloaded: ${filename}`);
    } catch (err) {
        console.error(`Error downloading ${url}:`, err.message);
    }
}

function isDirectImage(url) {
    return /\.(jpg|jpeg|png|gif|webp)$/.test(new URL(url).pathname);
}

// Detects platform from URL
function detectPlatform(url) {
    if (/instagram\.com/.test(url)) return 'instagram';
    if (/facebook\.com/.test(url)) return 'facebook';
    if (/reddit\.com/.test(url) || /preview\.redd\.it/.test(url) || /i\.redd\.it/.test(url)) return 'reddit';
    if (/youtube\.com|youtu\.be/.test(url)) return 'youtube';
    return null;
}

async function downloadInstagram(url, imagesDir) {
    try {
        console.log('Launching browser for Instagram...');
        const browser = await chromium.launch({ headless: true });
        const page = await browser.newPage();
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
        // Wait for images to load
        await page.waitForTimeout(4000);
        // Scrape images from the post content, excluding profile pics and icons
        const imageUrls = await page.evaluate(() => {
            const imgs = Array.from(document.querySelectorAll('img'));
            return imgs
                .map(img => img.src)
                .filter(src => {
                    if (!src) return false;
                    // Exclude profile pictures and icons by filtering common patterns
                    // Profile pics and icons often have 'profile' or 'icon' or 'avatar' in URL or alt text
                    if (src.includes('profile') || src.includes('icon') || src.includes('avatar')) return false;
                    return true;
                });
        });
        if (imageUrls.length === 0) {
            console.error('No images found on Instagram post.');
        } else {
            if (!fs.existsSync(imagesDir)) fs.mkdirSync(imagesDir, { recursive: true });
            let count = 1;
            for (const imgUrl of imageUrls) {
                const ext = path.extname(new URL(imgUrl).pathname) || '.jpg';
                await downloadImage(imgUrl, imagesDir, `instagram_${count}${ext}`);
                count++;
            }
        }
        await browser.close();
    } catch (err) {
        console.error('Failed to download Instagram images:', err.message);
    }
}

async function downloadFacebook(url, imagesDir) {
    // Use Playwright to scrape images from a Facebook post
    try {
        const storageStatePath = path.resolve('./facebook_cookies.json');
        if (!fs.existsSync(storageStatePath)) {
            await facebookManualLogin();
        }
        console.log('Launching browser for Facebook...');
        const browser = await chromium.launch({ headless: false });
        const context = await browser.newContext({ storageState: storageStatePath });
        const page = await context.newPage();
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
        // Wait for images to load
        await page.waitForTimeout(4000);
        // Try to get images from the post
        const imageUrls = await page.evaluate(() => {
            // Facebook images are often in <img> with src containing "scontent"
            const imgs = Array.from(document.querySelectorAll('img'));
            return imgs
                .map(img => img.src)
                .filter(src => src && src.includes('scontent'));
        });
        if (imageUrls.length === 0) {
            console.error('No images found on Facebook post.');
        } else {
            if (!fs.existsSync(imagesDir)) fs.mkdirSync(imagesDir, { recursive: true });
            let count = 1;
            for (const imgUrl of imageUrls) {
                const ext = path.extname(new URL(imgUrl).pathname) || '.jpg';
                await downloadImage(imgUrl, imagesDir, `facebook_${count}${ext}`);
                count++;
            }
        }
        await browser.close();
    } catch (err) {
        console.error('Failed to download Facebook images:', err.message);
    }
}

async function downloadReddit(url, imagesDir) {
    try {
        console.log('Fetching Reddit post JSON...');
        // Remove fragment like #lightbox
        const cleanUrl = url.split('#')[0];
        const jsonUrl = cleanUrl.endsWith('/') ? `${cleanUrl}.json` : `${cleanUrl}/.json`;
        const res = await fetch(jsonUrl);
        if (!res.ok) {
            console.error('Failed to fetch Reddit post JSON.');
            return;
        }
        const jsonData = await res.json();
        if (!Array.isArray(jsonData) || jsonData.length === 0) {
            console.error('Invalid Reddit JSON response.');
            return;
        }
        const postData = jsonData[0]?.data?.children[0]?.data;
        if (!postData) {
            console.error('Could not find post data in Reddit JSON.');
            return;
        }
        let imageUrls = [];
        // Check if the post URL itself is a direct image
        if (isDirectImage(postData.url)) {
            imageUrls.push(postData.url);
        }
        // Check for gallery images
        if (postData.gallery_data && postData.media_metadata) {
            const galleryItems = postData.gallery_data.items;
            for (const item of galleryItems) {
                const media = postData.media_metadata[item.media_id];
                if (media && media.s && media.s.u) {
                    // URLs sometimes have &amp; instead of &
                    const urlDecoded = media.s.u.replace(/&amp;/g, '&');
                    imageUrls.push(urlDecoded);
                }
            }
        }
        // Check for preview images if no gallery
        if (imageUrls.length === 0 && postData.preview && postData.preview.images) {
            for (const img of postData.preview.images) {
                if (img.source && img.source.url) {
                    const urlDecoded = img.source.url.replace(/&amp;/g, '&');
                    imageUrls.push(urlDecoded);
                }
            }
        }
        if (imageUrls.length === 0) {
            console.error('No images found on Reddit post.');
            return;
        }
        if (!fs.existsSync(imagesDir)) fs.mkdirSync(imagesDir, { recursive: true });
        let count = 1;
        for (const imgUrl of imageUrls) {
            const ext = path.extname(new URL(imgUrl).pathname) || '.jpg';
            await downloadImage(imgUrl, imagesDir, `reddit_${count}${ext}`);
            count++;
        }
    } catch (err) {
        console.error('Failed to download Reddit images:', err.message);
    }
}

async function downloadYouTube(url, imagesDir) {
    // Use Playwright to scrape thumbnails from a YouTube video page
    try {
        console.log('Launching browser for YouTube...');
        const browser = await chromium.launch({ headless: true });
        const page = await browser.newPage();
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 });
        await page.waitForTimeout(2000);
        // Try to get the video id from the URL
        let videoId = null;
        const match = url.match(/(?:v=|youtu\.be\/|\/shorts\/)([A-Za-z0-9_-]{11})/);
        if (match) {
            videoId = match[1];
        } else {
            // Try to extract from canonical link
            videoId = await page.evaluate(() => {
                const link = document.querySelector('link[rel="canonical"]');
                if (!link) return null;
                const url = link.href;
                const m = url.match(/(?:v=|youtu\.be\/|\/shorts\/)([A-Za-z0-9_-]{11})/);
                return m ? m[1] : null;
            });
        }
        if (!videoId) {
            console.error('Could not extract YouTube video ID.');
            await browser.close();
            return;
        }
        // YouTube thumbnail patterns
        const thumbUrls = [
            `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
            `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
            `https://img.youtube.com/vi/${videoId}/sddefault.jpg`,
            `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`
        ];
        if (!fs.existsSync(imagesDir)) fs.mkdirSync(imagesDir, { recursive: true });
        let found = false;
        let count = 1;
        for (const imgUrl of thumbUrls) {
            // Try downloading each thumbnail, only if it exists (status 200)
            try {
                const res = await fetch(imgUrl);
                if (res.ok) {
                    const ext = path.extname(new URL(imgUrl).pathname) || '.jpg';
                    await downloadImage(imgUrl, imagesDir, `youtube_${count}${ext}`);
                    found = true;
                }
            } catch (e) {
                // skip
            }
            count++;
        }
        if (!found) {
            console.error('No thumbnails found for YouTube video.');
        }
        await browser.close();
    } catch (err) {
        console.error('Failed to download YouTube images:', err.message);
    }
}

async function main() {
    let url = process.argv[2];
    if (!url) {
        url = await prompt('Enter the social media post URL: ');
    }
    url = url.trim();
    if (!/^https?:\/\//.test(url)) {
        console.error('Invalid URL. Must start with http:// or https://');
        process.exit(1);
    }
    const platform = detectPlatform(url);
    if (!platform) {
        console.error('Unsupported or unrecognized platform. Supported: Instagram, Facebook, Reddit, YouTube.');
        process.exit(1);
    }
    const imagesDir = path.join(__dirname, 'images');
    if (isDirectImage(url)) {
        if (!fs.existsSync(imagesDir)) fs.mkdirSync(imagesDir, { recursive: true });
        const ext = path.extname(new URL(url).pathname);
        await downloadImage(url, imagesDir, `direct_image${ext}`);
        console.log('Downloaded direct image URL.');
        return;
    }
    console.log(`Detected platform: ${platform}`);
    switch (platform) {
        case 'instagram':
            await downloadInstagram(url, imagesDir);
            break;
        case 'facebook':
            await downloadFacebook(url, imagesDir);
            break;
        case 'reddit':
            await downloadReddit(url, imagesDir);
            break;
        case 'youtube':
            await downloadYouTube(url, imagesDir);
            break;
        default:
            console.error('Platform not implemented.');
    }
    console.log('Done.');
}

main();