#!/bin/bash
set -e

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Set AWS_PROFILE if not already set
if [ -n "$AWS_PROFILE" ]; then
    export AWS_PROFILE
fi

cdk deploy "$@"
