# 🚀 Production Certificate Generation Setup

## 📋 Overview

Ada **3 opsi** untuk production certificate generation:

| Opsi | Pro | Con | Recommended |
|------|-----|-----|-------------|
| **1. Supabase Edge Function + Cron** | ✅ Fully serverless<br>✅ Auto-scaling<br>✅ No server management | Requires Supabase CLI | ⭐ **BEST** |
| **2. Cloudflare Worker + Cron** | ✅ Fast globally<br>✅ Cheap | Requires Cloudflare setup | Good |
| **3. Manual Button in Admin** | ✅ Simple<br>✅ No cron needed | Manual work | Okay |

---

## ⭐ **Option 1: Supabase Edge Function (RECOMMENDED)**

### **Step 1: Deploy Edge Function**

```bash
# Install Supabase CLI (if not installed)
brew install supabase/tap/supabase

# Login
supabase login

# Link project
supabase link --project-ref mtaqyjyezfadfewbdlrf

# Deploy function
supabase functions deploy generate-certificates
```

### **Step 2: Test Function**

```bash
# Test locally first
supabase functions serve generate-certificates

# In another terminal, test:
curl -X POST http://localhost:54321/functions/v1/generate-certificates \
  -H "Content-Type: application/json" \
  -d '{"event_id": "6f4d2f11-325e-4dc5-a61d-cb154393e715"}'
```

### **Step 3: Setup Cron (Auto-Generate)**

**Option A: Via Supabase Dashboard (Easiest)**

1. Go to **Supabase Dashboard** → Your Project
2. Navigate to **Database** → **Cron Jobs**
3. Click **Create Cron Job**
4. Configure:
   ```sql
   -- Name: Generate Certificates
   -- Schedule: */5 * * * * (every 5 minutes)
   -- Command:
   SELECT
     net.http_post(
       url := 'https://mtaqyjyezfadfewbdlrf.supabase.co/functions/v1/generate-certificates',
       headers := '{"Content-Type": "application/json", "Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb,
       body := '{}'::jsonb
     ) as request_id;
   ```

**Option B: Via SQL (Alternative)**

```sql
-- Install pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create cron job
SELECT cron.schedule(
  'generate-certificates',
  '*/5 * * * *', -- Every 5 minutes
  $$
  SELECT
    net.http_post(
      url := 'https://mtaqyjyezfadfewbdlrf.supabase.co/functions/v1/generate-certificates',
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb,
      body := '{}'::jsonb
    ) as request_id;
  $$
);
```

### **Step 4: Monitor**

```sql
-- Check cron job status
SELECT * FROM cron.job;

-- View cron job runs
SELECT * FROM cron.job_run_details ORDER BY start_time DESC LIMIT 10;

-- Check certificate generation status
SELECT status, COUNT(*) FROM certificates GROUP BY status;
```

---

## 🔵 **Option 2: Cloudflare Worker (Alternative)**

### **Step 1: Create Worker**

File: `workers/generate-certificates.js`

```javascript
export default {
  async scheduled(event, env, ctx) {
    // Call your API or direct database
    const response = await fetch('https://your-domain.com/api/generate-certificates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    
    console.log('Certificate generation result:', await response.json());
  },
};
```

### **Step 2: Deploy to Cloudflare**

```bash
# Install Wrangler
npm install -g wrangler

# Login
wrangler login

# Deploy
wrangler deploy workers/generate-certificates.js

# Add cron trigger
# In wrangler.toml:
[triggers]
crons = ["*/5 * * * *"]
```

---

## 🟢 **Option 3: Manual Button (Simplest)**

Update admin UI to call the standalone script or Edge Function.

### **Step 1: Add Generate Button**

In `src/routes/admin._auth.attendance.$id.tsx`, button sudah ada:

```tsx
<Button onClick={generateCertificates}>
  <Award className="size-4 mr-2" />
  Generate Sertifikat ({pendingCerts})
</Button>
```

### **Step 2: Make It Call Production Endpoint**

Update `generateCertificates` function:

```typescript
async function generateCertificates() {
  setGenerating(true);
  
  try {
    // Call Supabase Edge Function
    const response = await fetch(
      'https://mtaqyjyezfadfewbdlrf.supabase.co/functions/v1/generate-certificates',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabase.auth.session()?.access_token}`,
        },
        body: JSON.stringify({ event_id: id }),
      }
    );
    
    const result = await response.json();
    
    if (result.success) {
      toast.success(result.message);
      qc.invalidateQueries({ queryKey: ["admin", "attendance", id] });
    } else {
      throw new Error(result.error);
    }
  } catch (error) {
    toast.error(error.message);
  } finally {
    setGenerating(false);
  }
}
```

---

## 🎯 **Comparison Table**

| Feature | Supabase Edge + Cron | Cloudflare Worker | Manual Button |
|---------|---------------------|-------------------|---------------|
| **Automation** | ✅ Fully automatic | ✅ Fully automatic | ❌ Manual |
| **Scalability** | ✅ Auto-scales | ✅ Auto-scales | ⚠️ Depends on user |
| **Cost** | Free tier: 500K requests/mo | Free tier: 100K requests/day | Free |
| **Setup Complexity** | ⭐⭐⭐ Medium | ⭐⭐⭐⭐ Advanced | ⭐ Easy |
| **Maintenance** | ⭐⭐⭐⭐⭐ None | ⭐⭐⭐⭐ Low | ⭐⭐⭐ Manual work |
| **Latency** | Fast | Very fast (global) | Depends |
| **Monitoring** | Dashboard | Dashboard | Manual check |

---

## 💡 **My Recommendation**

### **For Production:**

**Use Supabase Edge Function + Cron** (Option 1)

**Why:**
1. ✅ **Zero server management** - Supabase handles everything
2. ✅ **Auto-scaling** - Handles traffic spikes automatically
3. ✅ **Built-in monitoring** - View logs in Supabase Dashboard
4. ✅ **Free tier generous** - 500K invocations/month
5. ✅ **Already using Supabase** - No new services needed

### **Deployment Steps (5 minutes):**

```bash
# 1. Deploy function
supabase functions deploy generate-certificates

# 2. Setup cron via Dashboard
# Go to: Database → Cron Jobs → Create

# 3. Test
# Wait 5 minutes and check certificates table

# Done! ✅
```

---

## 🔧 **Troubleshooting**

### **Edge Function Not Working?**

```bash
# Check function logs
supabase functions logs generate-certificates

# Test locally first
supabase functions serve generate-certificates

# Deploy with verbose output
supabase functions deploy generate-certificates --debug
```

### **Cron Not Triggering?**

```sql
-- Check pg_cron installed
SELECT * FROM pg_available_extensions WHERE name = 'pg_cron';

-- Check cron jobs
SELECT * FROM cron.job;

-- Check recent runs
SELECT * FROM cron.job_run_details 
ORDER BY start_time DESC 
LIMIT 10;
```

### **Certificates Not Generating?**

```sql
-- Check pending queue
SELECT * FROM certificate_queue WHERE status = 'pending';

-- Check failed attempts
SELECT * FROM certificate_queue 
WHERE status = 'failed' 
ORDER BY created_at DESC;

-- Check error messages
SELECT 
  error_message,
  COUNT(*) as count
FROM certificate_queue
WHERE status = 'failed'
GROUP BY error_message;
```

---

## 📊 **Monitoring Dashboard Query**

```sql
-- Overall certificate generation stats
SELECT 
  'Total Checked In' as metric,
  COUNT(*) as value
FROM event_registrations
WHERE checked_in_at IS NOT NULL

UNION ALL

SELECT 
  'Certificates Generated' as metric,
  COUNT(*) as value
FROM certificates
WHERE status = 'generated'

UNION ALL

SELECT 
  'Pending Generation' as metric,
  COUNT(*) as value
FROM certificate_queue
WHERE status = 'pending'

UNION ALL

SELECT 
  'Failed Generation' as metric,
  COUNT(*) as value
FROM certificate_queue
WHERE status = 'failed';
```

---

## ✅ **Quick Start (Copy-Paste)**

```bash
# 1. Deploy Edge Function
cd /Users/latif/eco-digital-event
supabase functions deploy generate-certificates

# 2. Get function URL
echo "Function URL: https://mtaqyjyezfadfewbdlrf.supabase.co/functions/v1/generate-certificates"

# 3. Test it
curl -X POST "https://mtaqyjyezfadfewbdlrf.supabase.co/functions/v1/generate-certificates" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY"

# 4. Setup cron in Supabase Dashboard
# Done! ✅
```

---

## 🎉 **Result**

After setup:
- ✅ **Automatic generation** every 5 minutes
- ✅ **No manual intervention** needed
- ✅ **Scalable** to thousands of participants
- ✅ **Monitored** via Supabase Dashboard
- ✅ **Zero server costs** (within free tier)

**Your certificate system is now production-ready!** 🚀
