# Pad in a Box

The Pad in a Box static website is intended to be hosted at **https://pad.notjack.au** using GitHub Pages.

## First deployment

1. Download and unzip **Pad-in-a-Box-GitHub-Ready.zip**, the latest deployment package from the ChatGPT project.
2. In this repository select **Add file → Upload files**.
3. Drag the *contents* of the extracted folder (including `index.html`, all JS/CSS files, `cello.wasm`, `violin.wasm`, `presets/`, `strings-lab/`, and `licenses/`) into the uploader. Do not upload the ZIP as one file or put the app in a nested folder.
4. Commit the upload to `main`. Preserve the existing `CNAME` file (`pad.notjack.au`).
5. In **Settings → Pages**, select **Deploy from a branch**, `main`, `/ (root)`, and **Save**.
6. Wait for the GitHub Pages deployment to finish successfully in the repository's **Actions** tab. Because the custom domain is already configured, the default github.io link may redirect before your DNS is changed.
7. When ready to cut over, at Chirpy change the `pad` CNAME from `custom-domains.chatgpt.site` to `dannotjack.github.io`. Do not change the apex `notjack.au` or unrelated subdomains.
8. After DNS propagation, verify `https://pad.notjack.au`, the audio engine and the mixer. Enable **Enforce HTTPS** in Pages once available.

**Note:** Mixer settings, custom phrases and other locally saved data are browser- and origin-specific. Export from the previous pad site and import into the new one if you wish to keep them.

**Third-party component:** Nemus EfficientBowedString: https://github.com/Nemus-Project/EfficientBowedString . Permission to redistribute was stated by the site owner; retain any applicable permission records and notices. Organ adaptation: https://github.com/gpasquero/hammond-b3 (MIT notice in `licenses/hammond-b3-MIT.txt`).
