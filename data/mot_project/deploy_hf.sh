#!/bin/bash

echo "==========================================="
echo "   Hugging Face Spaces Deployer Script     "
echo "==========================================="
echo ""

# Check if git is installed
if ! command -v git &> /dev/null; then
    echo "Error: git is not installed on your system. Please install git and try again."
    exit 1
fi

# Ask for the Hugging Face space Git repository URL
read -p "Enter your Hugging Face Space Git URL (e.g., https://huggingface.co/spaces/username/space-name): " HF_REPO_URL

if [ -z "$HF_REPO_URL" ]; then
    echo "Error: Space URL cannot be empty."
    exit 1
fi

# Create a temporary deployment directory
DEPLOY_DIR="hf_deploy"
echo "Preparing deployment directory ($DEPLOY_DIR)..."
rm -rf "$DEPLOY_DIR"
mkdir -p "$DEPLOY_DIR"

# Copy required files and folders
cp app.py "$DEPLOY_DIR/"
cp tracker.py "$DEPLOY_DIR/"
cp requirements.txt "$DEPLOY_DIR/"
cp Dockerfile "$DEPLOY_DIR/"
cp hf_README.md "$DEPLOY_DIR/README.md"
cp -r templates "$DEPLOY_DIR/"
cp -r static "$DEPLOY_DIR/"

# Copy model weights
if [ -d "runs/detect/train" ]; then
    echo "Copying finetuned model weights..."
    mkdir -p "$DEPLOY_DIR/runs/detect"
    cp -r runs/detect/train "$DEPLOY_DIR/runs/detect/"
fi

# Initialize git repo in the deploy directory
cd "$DEPLOY_DIR"
git init -b main
git remote add origin "$HF_REPO_URL"

# Initialize Git LFS for binary files
git lfs install
git lfs track "*.pt"
git lfs track "*.png"
git lfs track "*.jpg"
git lfs track "*.jpeg"


echo ""
echo "Files staged for deployment. To deploy, we will push this commit to Hugging Face."
echo "Hugging Face might ask you for your Username and Password (use your Access Token as the password)."
echo ""

git add .
git commit -m "Deploy AerialMOT video tracking app"

echo "Running: git push -u origin main --force"
git push -u origin main --force

# Cleanup
cd ..
rm -rf "$DEPLOY_DIR"

echo ""
echo "==========================================="
echo "Deployment process finished!"
echo "Check your Hugging Face Space page for the build logs."
echo "==========================================="
