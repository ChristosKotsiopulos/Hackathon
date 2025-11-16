# Collaboration Setup Guide

## Repository Information
- **Repository URL**: https://github.com/AdiSchoolGit/Hackathon12.git
- **Default Branch**: `main`

## Adding Collaborators

To allow other people to commit and push to this repository:

### Step 1: Add Collaborators on GitHub
1. Go to your repository on GitHub: https://github.com/AdiSchoolGit/Hackathon12
2. Click on **Settings** (top right of the repository page)
3. Click on **Collaborators** in the left sidebar
4. Click **Add people** button
5. Enter the GitHub username or email of the person you want to add
6. Select their permission level:
   - **Write** - Allows them to push commits and create branches
   - **Maintain** - Write access + manage issues/pull requests
   - **Admin** - Full access (can delete repository)
7. Click **Add [username] to this repository**

### Step 2: Collaborator Setup (for the person being added)
Once added, the collaborator needs to:

1. **Clone the repository:**
   ```bash
   git clone https://github.com/AdiSchoolGit/Hackathon12.git
   cd Hackathon12
   ```

2. **Set up their environment:**
   ```bash
   # Backend setup
   cd backend
   npm install
   cp .env.example .env  # Edit .env with their own API keys
   
   # Frontend setup
   cd ../frontend
   npm install
   cp .env.example .env  # Edit .env with their IP address
   ```

3. **Make changes and push:**
   ```bash
   git add .
   git commit -m "Your commit message"
   git push origin main
   ```

## Branch Protection (Optional)

If you want to require pull requests before merging:

1. Go to **Settings** > **Branches**
2. Click **Add rule** or edit existing rule for `main`
3. Enable:
   - ✅ Require pull request reviews before merging
   - ✅ Require status checks to pass before merging
   - ✅ Require branches to be up to date before merging

**Note:** If branch protection is enabled, collaborators will need to:
- Create a new branch: `git checkout -b feature-name`
- Push the branch: `git push origin feature-name`
- Create a Pull Request on GitHub
- Get approval before merging

## Current Status

✅ **Repository is set up for collaboration**
- No branch protection rules detected
- Collaborators can push directly to `main` branch
- HTTPS authentication (requires GitHub credentials)

## Troubleshooting

### "Permission denied" error
- Make sure you're added as a collaborator on GitHub
- Check that you're using the correct GitHub credentials
- Try using a Personal Access Token instead of password

### "Remote rejected" error
- Check if branch protection is enabled
- Make sure you're pushing to the correct branch
- Pull latest changes first: `git pull origin main`

## Security Notes

⚠️ **Important Files in .gitignore:**
- `.env` files (contain API keys)
- `hackathon-*.json` (Google Cloud credentials)
- `node_modules/` (dependencies)
- `uploads/` (user-uploaded files)

These files are **NOT** committed to git for security reasons. Each collaborator needs to create their own `.env` files.

