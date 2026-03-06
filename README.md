# growl-audio-landing

Landing page for [growl-audio.com](https://growl-audio.com), deployed to AWS S3 + CloudFront via CDK.

## Development

```bash
npm run dev       # Start Vite dev server
npm run build     # Build to dist/
npm run preview   # Preview production build
```

## Deploying the site

```bash
cd deploy
npm run build     # Compile CDK TypeScript
npm run deploy    # Deploy to AWS
```

## Uploading plugin artifacts

Place the built plugin zips in an `artifacts/` folder (gitignored), then run:

```bash
AWS_PROFILE=growl-audio BUCKET_NAME=growlaudiowebsite-websitebucket75c24d94-96wpkj3dcpgr npm run upload
```

Expected files:
- `artifacts/gFractor-mac.zip`
- `artifacts/gFractor-win.zip`
- `artifacts/gFractor-linux.zip`

After uploading, files are served via CloudFront at:
- `https://growl-audio.com/downloads/gFractor-mac.zip`
- `https://growl-audio.com/downloads/gFractor-win.zip`
- `https://growl-audio.com/downloads/gFractor-linux.zip`

> If you re-upload a file with the same name, run a CloudFront invalidation manually:
> ```bash
> AWS_PROFILE=growl-audio aws cloudfront create-invalidation --distribution-id <ID> --paths "/downloads/*"
> ```
