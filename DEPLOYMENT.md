# Deployment Guide for TeslaJustice

This guide provides detailed instructions for deploying the TeslaJustice application to production.

## Prerequisites

- A Supabase account
- A Vercel account (or alternative hosting platform)
- Twitter Developer API access (for social media monitoring)
- Node.js and npm installed locally

## Step 1: Set Up Supabase Database

1. **Create a Supabase Project**:
   - Go to [Supabase](https://app.supabase.com/) and create a new project
   - Note your project URL and API keys (anon/public and service_role)

2. **Initialize Database Schema**:
   - Navigate to the SQL Editor in your Supabase dashboard
   - Copy and paste the contents of `supabase-schema.sql` into the editor
   - Run the SQL script to create all necessary tables and functions

3. **Configure Authentication**:
   - In the Supabase dashboard, go to Authentication → Settings
   - Enable Email/Password sign-in
   - Configure Google OAuth if desired
   - Set up email templates for authentication emails

## Step 2: Configure Environment Variables

Create a `.env` file in the root of your project with the following variables:

```
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_TWITTER_BEARER_TOKEN=your-twitter-api-token
VITE_GOOGLE_MAPS_API_KEY=your-google-maps-api-key
```

For production deployment, you'll need to add these environment variables to your hosting platform.

## Step 3: Build the Application

Run the following commands to build the application for production:

```bash
# Install dependencies
npm install

# Build for production
npm run build
```

This will create a production-ready build in the `build` directory.

## Step 4: Deploy to Vercel

1. **Install Vercel CLI** (optional):
   ```bash
   npm install -g vercel
   ```

2. **Deploy using Vercel CLI**:
   ```bash
   vercel
   ```

   Or deploy directly from the Vercel dashboard:
   - Connect your GitHub repository
   - Import the project
   - Configure environment variables
   - Deploy

3. **Configure Environment Variables in Vercel**:
   - Add all the environment variables from your `.env` file
   - Ensure they are added to both Production and Preview environments

## Step 5: Set Up Scheduled Monitoring

### Option 1: Vercel Cron Jobs

1. Create a `vercel.json` file in the root of your project:
   ```json
   {
     "crons": [
       {
         "path": "/api/run-monitoring",
         "schedule": "0 */6 * * *"
       }
     ]
   }
   ```

2. Create an API endpoint at `src/routes/api/run-monitoring/+server.ts`:
   ```typescript
   import { runFullMonitoringCycle } from '$lib/monitoringSystem';
   
   export async function GET() {
     try {
       const results = await runFullMonitoringCycle();
       return new Response(JSON.stringify(results), {
         status: 200,
         headers: {
           'Content-Type': 'application/json'
         }
       });
     } catch (error) {
       return new Response(JSON.stringify({ error: error.message }), {
         status: 500,
         headers: {
           'Content-Type': 'application/json'
         }
       });
     }
   }
   ```

### Option 2: External Scheduler (e.g., AWS Lambda)

1. Create a Lambda function that calls your monitoring endpoint
2. Set up a CloudWatch Event to trigger the Lambda function on schedule
3. Ensure the Lambda has the necessary permissions to call your API

## Step 6: Post-Deployment Verification

After deployment, verify the following:

1. **Authentication** works correctly
2. **Database connections** are functioning
3. **Social media monitoring** is running as expected
4. **Scheduled tasks** are executing properly
5. **All pages** load correctly and are responsive

## Troubleshooting

### Common Issues

1. **Database Connection Errors**:
   - Verify environment variables are correctly set
   - Check Supabase service status
   - Ensure IP restrictions aren't blocking your hosting provider

2. **Authentication Problems**:
   - Verify Supabase authentication settings
   - Check redirect URLs for OAuth providers
   - Ensure email templates are configured correctly

3. **Social Media API Limitations**:
   - Monitor Twitter API rate limits
   - Implement backoff strategies for API calls
   - Consider upgrading API access tier if needed

4. **Scheduled Task Failures**:
   - Check logs for error messages
   - Verify endpoint permissions
   - Ensure monitoring functions have proper error handling

## Maintenance

Regular maintenance tasks:

1. **Database Backups**:
   - Set up regular backups of your Supabase database
   - Test restoration procedures periodically

2. **API Key Rotation**:
   - Regularly rotate API keys for security
   - Update environment variables after rotation

3. **Dependency Updates**:
   - Regularly update npm packages for security patches
   - Test thoroughly after updates

4. **Monitoring and Logging**:
   - Set up error tracking (e.g., Sentry)
   - Implement performance monitoring
   - Review logs regularly for issues

## Support

For issues or questions about deployment, please contact the development team.
