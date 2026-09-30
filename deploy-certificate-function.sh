#!/bin/bash

# Deploy Certificate Generation to Production
# This script deploys the Edge Function and sets up automatic processing

set -e

echo "🚀 Deploying Certificate Generation System to Production..."
echo ""

# Check if supabase CLI installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found!"
    echo "Install: brew install supabase/tap/supabase"
    exit 1
fi

echo "✅ Supabase CLI found"
echo ""

# Check if logged in
if ! supabase projects list &> /dev/null; then
    echo "🔐 Not logged in. Logging in..."
    supabase login
fi

echo "✅ Logged in to Supabase"
echo ""

# Link project if not linked
if [ ! -f ".supabase/config.toml" ]; then
    echo "🔗 Linking project..."
    supabase link --project-ref mtaqyjyezfadfewbdlrf
fi

echo "✅ Project linked"
echo ""

# Deploy function
echo "📦 Deploying generate-certificates function..."
supabase functions deploy generate-certificates --no-verify-jwt

echo ""
echo "✅ Function deployed successfully!"
echo ""

# Get function URL
FUNCTION_URL="https://mtaqyjyezfadfewbdlrf.supabase.co/functions/v1/generate-certificates"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎉 DEPLOYMENT SUCCESSFUL!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📍 Function URL:"
echo "   $FUNCTION_URL"
echo ""
echo "🧪 Test with:"
echo "   curl -X POST \"$FUNCTION_URL\" \\"
echo "     -H \"Content-Type: application/json\""
echo ""
echo "⏰ Next Steps:"
echo "   1. Go to Supabase Dashboard → Database → Cron Jobs"
echo "   2. Create new cron job:"
echo "      - Name: generate-certificates"
echo "      - Schedule: */5 * * * * (every 5 minutes)"
echo "      - SQL: Call the function above"
echo ""
echo "📖 Full guide: PRODUCTION_CERTIFICATE_SETUP.md"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
