# Setup Instructions

## Prerequisites

### 1. Install Node.js

**Option A: Download from Official Website**
1. Go to https://nodejs.org/
2. Download the LTS (Long Term Support) version
3. Run the installer and follow the setup wizard
4. Restart your terminal/command prompt

**Option B: Using Chocolatey (Windows)**
```powershell
# Install Chocolatey first if you don't have it
# Then run:
choco install nodejs
```

**Option C: Using Winget (Windows 10/11)**
```powershell
winget install OpenJS.NodeJS
```

### 2. Verify Installation
After installation, restart your terminal and run:
```bash
node --version
npm --version
```

Both commands should return version numbers.

## Running the Application

1. **Navigate to the project directory**
   ```bash
   cd ai-data-generator
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   - Copy `env-template.txt` to `.env`
   - Edit `.env` and add your OpenAI API key:
   ```
   OPENAI_API_KEY=your_actual_api_key_here
   ```

4. **Start the application**
   ```bash
   npm start
   ```

5. **Open your browser**
   Navigate to `http://localhost:5000`

## Getting an OpenAI API Key

1. Go to https://platform.openai.com/
2. Sign up or log in
3. Navigate to "API Keys" in your account
4. Create a new API key
5. Copy the key and paste it in your `.env` file

## Alternative: Static Version

If you can't install Node.js, you can use the static HTML version:

1. Open `public/index.html` directly in your browser
2. Note: The AI generation features won't work without the backend server
3. You can still view the UI and test the file upload interface

## Troubleshooting

### "node is not recognized"
- Make sure Node.js is installed
- Restart your terminal after installation
- Check if Node.js is in your system PATH

### "npm is not recognized"
- npm comes with Node.js
- If you have Node.js but not npm, try reinstalling Node.js

### Port 5000 already in use
- Change the PORT in your `.env` file to another number (e.g., 3000, 8000)
- Or stop the process using port 5000

### Permission errors
- Run your terminal as Administrator
- Or use a different port number 