#!/bin/bash

# Certificate Processor Cron Script
# This script runs the certificate processor and logs output

# Change to project directory
cd /Users/latif/eco-digital-event

# Load environment variables
export $(cat .env | grep -v '^#' | xargs)

# Run processor
/Users/latif/.bun/bin/bun run scripts/process-certificates.ts

# Exit
exit 0
