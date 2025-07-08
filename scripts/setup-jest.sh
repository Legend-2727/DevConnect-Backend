#!/bin/bash

# ==============================================================================
# Jest Setup Script for DevConnect Microservices
#
# This script automates the setup of Jest for all Node.js microservices
# found within the /services directory.
#
# It performs the following actions for each service:
#   1. Installs jest, supertest, and jest-extended as dev dependencies.
#   2. Creates a jest.config.js file with recommended settings.
#   3. Creates the standard __tests__ directory structure inside /src.
#   4. Adds test-related scripts (test, test:watch, test:coverage) to package.json.
#
# Prerequisites:
#   - Node.js and npm must be installed.
#   - 'jq' must be installed for safely editing package.json.
#     (e.g., `brew install jq` on macOS or `sudo apt-get install jq` on Debian/Ubuntu)
#
# Usage:
#   1. Place this script in the 'scripts/' directory of your repository.
#   2. Make it executable: `chmod +x scripts/setup-jest.sh`
#   3. Run it from the root of the repository: `./scripts/setup-jest.sh`
# ==============================================================================

# --- Configuration and Pre-flight Checks ---

# Exit immediately if a command exits with a non-zero status.
set -e

# Check for jq dependency, which is crucial for safely editing JSON files.
if ! command -v jq &> /dev/null; then
    echo -e "\033[0;31mError: 'jq' is not installed, but it's required to safely edit package.json.\033[0m"
    echo "Please install it to continue."
    echo "  On macOS: brew install jq"
    echo "  On Debian/Ubuntu: sudo apt-get install jq"
    exit 1
fi

# Define directories
BASE_DIR=$(pwd)
SERVICES_DIR="$BASE_DIR/services"

# Check if the script is being run from the correct directory
if [ ! -d "$SERVICES_DIR" ]; then
    echo -e "\033[0;31mError: 'services' directory not found.\033[0m"
    echo "Please run this script from the root of your 'DevConnect-Backend' repository."
    exit 1
fi

# --- Main Execution Loop ---

echo -e "\033[1;34mStarting Jest setup for all microservices...\033[0m"

# Loop through each subdirectory in the services directory.
# The trailing slash ensures we only match directories.
for SERVICE_PATH in "$SERVICES_DIR"/*/; do
    # Check if it's a directory before proceeding
    if [ -d "$SERVICE_PATH" ]; then
        SERVICE_NAME=$(basename "$SERVICE_PATH")

        echo -e "\n\033[1;36m--------------------------------------------------\033[0m"
        echo -e "\033[1;36mProcessing Service: $SERVICE_NAME\033[0m"
        echo -e "\033[1;36m--------------------------------------------------\033[0m"

        # Check if a package.json exists to identify it as a Node.js service
        if [ -f "$SERVICE_PATH/package.json" ]; then
            # Temporarily navigate into the service directory
            (
                cd "$SERVICE_PATH"

                # 1. Install dependencies
                echo "--> Installing dev dependencies (jest, supertest, jest-extended)..."
                npm install --save-dev jest supertest jest-extended --silent

                # 2. Create jest.config.js
                echo "--> Creating jest.config.js..."
                cat <<EOF > jest.config.js
// jest.config.js for $SERVICE_NAME

export default {
  // Automatically clear mock calls, instances, contexts and results before every test
  clearMocks: true,

  // The directory where Jest should output its coverage files
  coverageDirectory: "coverage",

  // An array of regexp pattern strings used to skip coverage collection
  coveragePathIgnorePatterns: [
    "/node_modules/"
  ],

  // Indicates which provider should be used to instrument code for coverage
  coverageProvider: "v8",

  // A list of reporter names that Jest uses when writing coverage reports
  coverageReporters: [
    "json",
    "text",
    "lcov",
    "clover"
  ],

  // The test environment that will be used for testing
  testEnvironment: "node",

  // The glob patterns Jest uses to detect test files
  testMatch: [
    "**/__tests__/**/*.js?(x)",
    "**/?(*.)+(spec|test).js?(x)"
  ],
};
EOF

                # 3. Create test directory structure
                if [ -d "src" ]; then
                    echo "--> Creating test directory structure in 'src/__tests__'..."
                    mkdir -p src/__tests__/controllers
                    mkdir -p src/__tests__/routes
                else
                    echo -e "\033[0;33mWarning: 'src' directory not found in $SERVICE_NAME. Skipping test directory creation.\033[0m"
                fi

                # 4. Add test scripts to package.json using jq
                echo "--> Adding test scripts to package.json..."
                # Use jq to merge new scripts into the existing scripts object.
                # This is safer than using sed/awk as it correctly parses the JSON structure.
                jq '.scripts += {"test": "jest", "test:watch": "jest --watchAll", "test:coverage": "jest --coverage"}' package.json > package.json.tmp && mv package.json.tmp package.json
                echo "    Scripts added successfully."

                echo -e "\033[0;32mSetup complete for $SERVICE_NAME.\033[0m"
            )
        else
            echo -e "\033[0;33mSkipping $SERVICE_NAME: No package.json found.\033[0m"
        fi
    fi
done

echo -e "\n\033[1;32m==================================================\033[0m"
echo -e "\033[1;32mAll services have been configured for Jest testing.\033[0m"
echo -e "\033[1;32mYou can now run 'npm test' within each service directory.\033[0m"
echo -e "\03-3[1;32m==================================================\033[0m"

