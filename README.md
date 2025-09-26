# Social Media Extractor

A Node.js tool to download social media **videos** and **images** (supports **Facebook Reels**, **Instagram Reels**, **Reddit videos**, and **YouTube Shorts**) and extract frames at configurable frame rates. Designed for **research, moderation, and educational purposes**.

⸻

## ⚠️ Disclaimer
- This tool is intended for **legal and ethical use only**.
- Users **must comply** with each platform’s Terms of Service and all applicable laws.
- Do **not use** this software to access or store private, restricted, or adult content without explicit permission.
- Example content shown is for demonstration purposes only.

⸻

## Features
- Download Facebook Reels
- Download Instagram Reels
- Download Reddit videos
- Download YouTube Shorts
- Download images from supported social media platforms
- Extract frames from videos at a configurable FPS
- Automatically stores frames in a dedicated folder (`./frames`)
- Automatically stores images in a dedicated folder (`./images`)
- Cookies are saved to `facebook_cookies.json`

⸻

## Installation

```bash
git clone https://github.com/<your-username>/social-media-frame-extractor.git
cd social-media-frame-extractor
npm install
```

> Requires `instaloader` installed on your system.

⸻

## NPM Scripts

You can now use npm scripts to download videos or images directly:

- Download videos:
```bash
npm run download-videos <CONTENT_URL> [FPS_NUMBER]
```

- Download images:
```bash
npm run download-images <CONTENT_URL>
```

- CLI Prompts
```bash
npm run extract
```

⸻

## Downloading Content
- Parameters:
  - `<CONTENT_URL>` – Full URL of the reel/video/image (Instagram, Facebook, Reddit, or YouTube Shorts).
  - `<FPS_NUMBER>` – Frames per second for videos (default 10). Not required for images.

Examples:
- Use extract command - follow prompts
  ```bash
  npm run extract
  ```
- Download Facebook Reel video with default 10 fps:
  ```bash
  npm run download-videos https://www.facebook.com/reel/123456789
  ```
- Download Facebook Reel video with custom FPS:
  ```bash
  npm run download-videos https://www.facebook.com/reel/123456789 20
  ```
- Download images from Instagram post:
  ```bash
  npm run download-images https://www.instagram.com/p/ABCDEFGHIJK/
  ```

- If no parameters are supplied, the scripts will prompt for the content URL and FPS (if applicable).

- Downloaded videos are saved as `facebook_<id>.mp4`, `instagram_<id>.mp4`, `reddit_<timestamp>.mp4`, or `youtube_<id>.mp4`.
- Extracted frames are saved as `frame_0001.png`, `frame_0002.png`, etc. in the `./frames` folder.
- Downloaded images are saved in the `./images` folder.

⸻

## Cleanup
To cleanup all the files in frames and images:
```bash
npm run cleanup
```
This will delete all files under the `frames` and `images` folders.

⸻

## Safety & Best Practices
- Only process **public or permitted content**.
- Use the tool for **AI/ML research, moderation, or educational purposes**.
- Regularly **clear downloaded content** after use.

⸻

## License
MIT License – see [LICENSE](LICENSE) for details.
