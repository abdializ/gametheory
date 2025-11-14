# Setting Up Custom Domain from Porkbun

This guide will help you connect a subdomain from Porkbun to your Vercel deployment.

## Step 1: Get Your Vercel Domain

1. Go to your Vercel dashboard
2. Click on your project
3. Go to **Settings** → **Domains**
4. Click **Add Domain**
5. Enter your subdomain (e.g., `prisoners-dilemma.yourdomain.com`)
6. Click **Add**

Vercel will show you the DNS records you need to configure.

## Step 2: Configure DNS in Porkbun

### Option A: Using CNAME (Recommended for Subdomains)

1. Log in to your Porkbun account
2. Go to **DNS** → Select your domain
3. Click **Add Record**
4. Configure the record:
   - **Type**: `CNAME`
   - **Host**: Your subdomain (e.g., `prisoners-dilemma` or `game` - without the domain part)
   - **Answer**: `cname.vercel-dns.com.` (note the trailing dot)
   - **TTL**: `600` (or default)
5. Click **Save**

### Option B: Using A Record (Alternative)

If CNAME doesn't work, use A records:

1. In Porkbun, add **A records**:
   - **Type**: `A`
   - **Host**: Your subdomain (e.g., `prisoners-dilemma`)
   - **Answer**: Use the IP addresses Vercel provides (usually 4 addresses like `76.76.21.21`)
   - **TTL**: `600`

## Step 3: Verify in Vercel

1. Go back to Vercel → Your Project → Settings → Domains
2. You should see your domain listed
3. Wait for DNS propagation (can take a few minutes to 48 hours)
4. Vercel will show a status:
   - ⏳ **Pending** - DNS is propagating
   - ✅ **Valid** - Domain is connected and working
   - ❌ **Invalid** - Check DNS configuration

## Step 4: SSL Certificate

Vercel automatically provisions SSL certificates (HTTPS) for your domain. This usually happens automatically within a few minutes after DNS is verified.

## Troubleshooting

### DNS Not Propagating?

1. **Check DNS records**: Make sure the CNAME or A records are correct
2. **Wait**: DNS can take up to 48 hours (usually much faster)
3. **Verify**: Use a DNS checker tool like `dnschecker.org` to see if your DNS has propagated globally
4. **Check Porkbun**: Make sure the records are saved correctly in Porkbun

### Domain Shows as Invalid?

1. Double-check the subdomain name matches exactly
2. Verify the CNAME/A record points to the correct Vercel address
3. Make sure there's no typo in the domain name
4. Remove any trailing slashes or extra characters

### Still Not Working?

1. Check Vercel's domain status page for specific error messages
2. Verify your domain is not already in use elsewhere
3. Make sure you have the correct permissions in Porkbun
4. Try removing and re-adding the domain in Vercel

## Example Configuration

If your domain is `example.com` and you want subdomain `game.example.com`:

**In Porkbun:**
- Type: `CNAME`
- Host: `game`
- Answer: `cname.vercel-dns.com.`
- TTL: `600`

**In Vercel:**
- Domain: `game.example.com`

## After Setup

Once your domain is verified:
- Your app will be accessible at `https://your-subdomain.yourdomain.com`
- Vercel automatically handles HTTPS
- All traffic will be redirected to your custom domain

