#!/bin/bash

echo "Starting 3-tier LMS directory structure setup..."

# 1. Create server folder and subdirectories
# NOTE: config lives in server/src/config (source of truth) - do NOT create a
# second server/config, that is what produced the empty duplicate configs.
echo "Creating server directories..."
mkdir -p server/src/config server/src/controllers server/src/middleware server/src/routes server/src/services server/src/validators server/tests

# 2. Frontend is the React SPA (client-react). Only ensure it is present; the
#    legacy vanilla client/ was retired in Phase 28 and lives in archive/.
echo "Ensuring frontend directory..."
mkdir -p client-react

# 3. Create database folder for migrations
echo "Creating database directories..."
mkdir -p database/migrations

# 4. Initialize npm (Creates package.json if it doesn't exist)
echo "Initializing npm..."
npm init -y

# 5. Install standard development dependencies
# Nodemon for auto-restarting the server, ESLint & Prettier for code formatting
echo "Installing standard dev dependencies..."
npm install --save-dev nodemon eslint prettier

echo "Setup complete! Your 3-tier LMS structure is ready."
