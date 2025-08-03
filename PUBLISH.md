# NPM Publishing Guide

## Steps to publish YTCE to NPM:

### 1. Update package.json
Before publishing, update these fields in `package.json`:
- `author.name` - Your name
- `author.email` - Your email
- `repository.url` - Your GitHub repository URL
- `bugs.url` - Your GitHub issues URL
- `homepage` - Your GitHub repository homepage

### 2. NPM Login
```bash
npm login
```

### 3. Test the package locally
```bash
npm run build
npm pack
```

### 4. Publish to NPM
```bash
npm publish
```

### 5. Verify publication
```bash
npm view ytce
```

## Post-publication:

### Update README badges
Replace in README.md:
- `https://github.com/your-username/ytce` with your actual GitHub URL

### Test installation
```bash
npm install ytce
```

### CLI usage after publication
```bash
npx ytce VIDEO_ID
```

## Version updates:
```bash
npm version patch  # 1.0.0 -> 1.0.1
npm version minor  # 1.0.0 -> 1.1.0
npm version major  # 1.0.0 -> 2.0.0
npm publish
```