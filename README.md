# AI Data Generator

An AI-powered data generation and visualization application that fetches financial data from Yahoo Finance and generates realistic future data patterns using either OpenAI's GPT models or built-in statistical methods.

## 🚀 Features

- **Yahoo Finance Integration**: Fetch real-time stock data with symbol search
- **AI-Powered Generation**: Generate realistic future data using OpenAI GPT models
- **Statistical Generation**: Built-in statistical methods for data generation (no external APIs required)
- **Multi-Timeframe Support**: Generate data for multiple timeframes (1min, 5min, 15min, 1hour, daily, weekly, monthly)
- **Interactive Visualization**: TradingView Lightweight Charts for professional financial charts
- **Playback Controls**: Animate through generated data with playback controls
- **Responsive Design**: Modern, dark-themed UI that works on desktop and mobile

## 📋 Prerequisites

- **Node.js** (v14 or higher)
- **npm** (comes with Node.js)
- **OpenAI API Key** (for AI generation features)

## 🛠️ Installation

1. **Clone the repository**
   ```bash
   git clone <your-repository-url>
   cd ai-data-generator2
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   # Copy the template file
   cp env-template.txt .env
   
   # Edit .env and add your OpenAI API key
   OPENAI_API_KEY=your_openai_api_key_here
   ```

4. **Start the application**
   ```bash
   npm start
   ```

5. **Open your browser**
   Navigate to `http://localhost:5000`

## 🎯 Usage

### 1. Fetch Data from Yahoo Finance
- Enter a stock symbol (e.g., AAPL, MSFT, TSLA)
- Use the search feature to find symbols
- Click "Fetch from Yahoo Finance" to get historical data

### 2. Choose Generation Method
- **AI Generation**: Uses OpenAI to create realistic patterns (requires API key)
- **Statistical Generation**: Uses built-in statistical methods (no API key needed)

### 3. Generate Future Data
- Select the number of data points to generate
- Choose your preferred timeframe
- Click "Generate New Data"

### 4. Visualize Results
- View generated data in interactive charts
- Use playback controls to animate through the data
- Switch between different timeframes

## 📁 Project Structure

```
ai-data-generator2/
├── public/                 # Frontend files
│   ├── index.html         # Main HTML file
│   └── script.js          # Frontend JavaScript
├── server.js              # Backend server
├── package.json           # Dependencies and scripts
├── env-template.txt       # Environment variables template
├── vercel.json           # Vercel deployment configuration
└── README.md             # This file
```

## 🔧 API Endpoints

- `GET /` - Serve the main application
- `POST /api/fetch-yfinance` - Fetch data from Yahoo Finance
- `POST /api/search-symbols` - Search for stock symbols
- `POST /api/generate` - Generate data using AI
- `POST /api/generate-builtin` - Generate data using statistical methods
- `POST /api/generate-multi-timeframe` - Generate multi-timeframe data
- `POST /api/analyze-structure` - Analyze data structure

## 🚀 Deployment

### Vercel (Recommended)
1. Push your code to GitHub
2. Connect your repository to Vercel
3. Deploy automatically

### Other Platforms
The application can be deployed to any Node.js hosting platform:
- Heroku
- Railway
- DigitalOcean App Platform
- AWS Elastic Beanstalk

## 🔑 Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `OPENAI_API_KEY` | Your OpenAI API key | For AI generation |
| `PORT` | Server port (default: 5000) | No |
| `NODE_ENV` | Environment (development/production) | No |

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Yahoo Finance API](https://finance.yahoo.com/) for financial data
- [OpenAI](https://openai.com/) for AI generation capabilities
- [TradingView Lightweight Charts](https://tradingview.github.io/lightweight-charts/) for charting
- [Express.js](https://expressjs.com/) for the backend framework

## 📞 Support

If you encounter any issues or have questions:
1. Check the [Issues](https://github.com/yourusername/ai-data-generator2/issues) page
2. Create a new issue with detailed information
3. Include your Node.js version and any error messages 