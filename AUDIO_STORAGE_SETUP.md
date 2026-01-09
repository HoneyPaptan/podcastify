# Environment Variables for Audio Storage

## Required for Vercel Blob Storage

When deploying to Vercel or using Vercel Blob storage, you need to add this environment variable:

### `BLOB_READ_WRITE_TOKEN`
- **Required**: Yes (for Vercel Blob storage)
- **How to get**: 
  1. Go to your Vercel project dashboard
  2. Navigate to Storage → Blob
  3. Create a new Blob store or use existing one
  4. Generate a read-write token
  5. Add it to your environment variables

### Local Development
For local development, no additional environment variables are needed. The system will:
1. Use local file storage in `public/audio/` directory
2. Automatically fall back gracefully if Blob token is missing
3. Use local files as cache even when Blob storage is available

### Environment Detection
The system automatically detects the environment:
- **Vercel Production**: Uses Blob storage if `BLOB_READ_WRITE_TOKEN` is present
- **Local Development**: Uses local file storage
- **Fallback**: Local storage if Blob token is missing or errors occur

## Storage Strategy

1. **Cache First**: Always checks local files first (fastest)
2. **Blob Storage**: Used in Vercel production when available
3. **Graceful Fallback**: Falls back to local storage if anything fails

## Free Tier Limits
- 1GB storage/month
- 10,000 operations/month  
- 10GB data transfer/month
- No overage charges (usage blocked if exceeded)

## Setup Instructions

1. **Vercel Deployment**:
   ```bash
   vercel env add BLOB_READ_WRITE_TOKEN
   ```

2. **Local Development**:
   - No setup required
   - Audio files stored in `public/audio/`
   - Works immediately

The system is designed to work seamlessly in both environments without breaking.