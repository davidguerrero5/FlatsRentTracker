#!/bin/bash

# Setup script for local environment variables

echo "Setting up .env file for local testing..."
echo ""

# Check if .env already exists
if [ -f .env ]; then
    echo "⚠️  .env file already exists!"
    read -p "Do you want to overwrite it? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Aborted. No changes made."
        exit 0
    fi
fi

# Create .env file with your credentials
cat > .env << 'EOF'
# Resend API Configuration for Local Testing
RESEND_API_KEY=re_fJLV23XF_8mZzLcnfFjrAiPyohDbNHkSq
RECIPIENT_EMAIL=dguerrero5296@gmail.com
SENDER_EMAIL=onboarding@resend.dev
EOF

echo "✅ .env file created successfully!"
echo ""
echo "You can now run:"
echo "  node notifier.js  - Test email sending"
echo "  npm start         - Run the full tracker"
echo ""
