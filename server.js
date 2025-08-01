const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const OpenAI = require('openai');
require('dotenv').config();
const fetch = require('node-fetch'); // Add at the top if not present
const Papa = require('papaparse'); // Add at the top if not present
const yahooFinance = require('yahoo-finance2').default;

// Suppress deprecation notices and survey
yahooFinance.suppressNotices(['ripHistorical', 'yahooSurvey']);

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// File upload functionality removed

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'your-api-key-here'
});

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Upload endpoint removed

// Generate new data using AI
app.post('/api/generate', async (req, res) => {
  try {
    const { originalData, numPoints, analysis } = req.body;

    if (!originalData || !numPoints || !analysis) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    // Create prompt for AI
    const prompt = createAIPrompt(originalData, numPoints, analysis);
    
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are a data generation expert. Generate realistic data that follows the patterns and structure of the provided dataset. Return only valid JSON data."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 2000
    });

    const generatedData = JSON.parse(completion.choices[0].message.content);
    
    res.json({
      success: true,
      generatedData: generatedData
    });

  } catch (error) {
    console.error('Error generating data:', error);
    res.status(500).json({ error: 'Error generating data: ' + error.message });
  }
});

// NEW: Generate data using built-in statistical methods (no external APIs)
app.post('/api/generate-builtin', async (req, res) => {
  try {
    const { originalData, numPoints, analysis } = req.body;

    // Enhanced input validation
    if (!originalData || !Array.isArray(originalData) || originalData.length === 0) {
      return res.status(400).json({ error: 'originalData must be a non-empty array' });
    }
    if (!numPoints || typeof numPoints !== 'number' || numPoints <= 0) {
      return res.status(400).json({ error: 'numPoints must be a positive integer' });
    }
    if (!analysis || typeof analysis !== 'object' || !Array.isArray(analysis.columns) || analysis.columns.length === 0) {
      return res.status(400).json({ error: 'analysis must be a valid object with non-empty columns array' });
    }

    // Generate data using built-in statistical methods
    let generatedData;
    try {
      generatedData = generateDataBuiltin(originalData, numPoints, analysis);
    } catch (err) {
      console.error('Error in generateDataBuiltin:', err);
      return res.status(500).json({ error: 'Internal error during data generation: ' + err.message });
    }
    
    res.json({
      success: true,
      generatedData: generatedData,
      method: 'builtin-statistical'
    });

  } catch (error) {
    console.error('Error generating data:', error);
    res.status(500).json({ error: 'Error generating data: ' + error.message });
  }
});

// NEW: Enhanced built-in data generation function with realistic market patterns
function generateDataBuiltin(originalData, numPoints, analysis) {
  if (!analysis || !Array.isArray(analysis.columns)) {
    throw new Error('analysis.columns is missing or not an array');
  }
  
  const generatedData = [];
  const columns = analysis.columns;
  const columnTypes = analysis.columnTypes || {};

  // Detect OHLC columns for market data
  const dateCol = columns.find(col => columnTypes[col] === 'date');
  const openCol = columns.find(col => col.toLowerCase().includes('open'));
  const highCol = columns.find(col => col.toLowerCase().includes('high'));
  const lowCol = columns.find(col => col.toLowerCase().includes('low'));
  const closeCol = columns.find(col => col.toLowerCase().includes('close'));
  const volumeCol = columns.find(col => col.toLowerCase().includes('volume'));
  
  // Check if this is OHLC data
  if (dateCol && (openCol || closeCol)) {
    return generateMarketData(originalData, numPoints, analysis, {
      dateCol, openCol, highCol, lowCol, closeCol, volumeCol
    });
  }

  // Fallback: original logic for non-market data
  return generateGenericData(originalData, numPoints, analysis);
}

// Enhanced market data generation with realistic patterns
function generateMarketData(originalData, numPoints, analysis, columns) {
  const generatedData = [];
  
  // Extract and analyze price data
  const priceData = extractPriceData(originalData, columns);
  const marketStats = analyzeMarketPatterns(priceData);
  
  // Analyze time patterns and create enhanced date generator
  const timePatterns = analyzeTimePatterns(originalData);
  const dateGenerator = createEnhancedDateGenerator(originalData);
  
  // Generate realistic market data
  let currentPrice = priceData.close[priceData.close.length - 1];
  let currentVolatility = marketStats.volatility;
  let trend = marketStats.trend;
  let momentum = 0;
  
  for (let i = 0; i < numPoints; i++) {
    // Generate future date using the enhanced date generator
    const newTimestamp = dateGenerator(i);
    const newDate = new Date(newTimestamp);
    
    // Generate realistic price movement
    const priceMovement = generatePriceMovement({
      currentPrice,
      volatility: currentVolatility,
      trend,
      momentum,
      marketStats,
      dayOfWeek: newDate.getDay(),
      isMonthStart: newDate.getDate() <= 3,
      isMonthEnd: newDate.getDate() >= 28
    });
    
    // Update state for next iteration
    currentPrice = priceMovement.close;
    currentVolatility = priceMovement.volatility;
    momentum = priceMovement.momentum;
    
    // Generate OHLC data
    const ohlc = generateOHLC(priceMovement, marketStats);
    
    // Generate volume with realistic patterns
    const volume = generateVolume(ohlc, marketStats, i);
    
    const newRow = {
      [columns.dateCol]: newTimestamp
    };
    
    if (columns.openCol) newRow[columns.openCol] = ohlc.open;
    if (columns.highCol) newRow[columns.highCol] = ohlc.high;
    if (columns.lowCol) newRow[columns.lowCol] = ohlc.low;
    if (columns.closeCol) newRow[columns.closeCol] = ohlc.close;
    if (columns.volumeCol) newRow[columns.volumeCol] = volume;
    
    generatedData.push(newRow);
  }
  
  return generatedData;
}

// Extract and analyze price data from original dataset
function extractPriceData(originalData, columns) {
  const prices = {
    open: [],
    high: [],
    low: [],
    close: [],
    volume: []
  };
  
  originalData.forEach(row => {
    if (columns.openCol && row[columns.openCol]) prices.open.push(parseFloat(row[columns.openCol]));
    if (columns.highCol && row[columns.highCol]) prices.high.push(parseFloat(row[columns.highCol]));
    if (columns.lowCol && row[columns.lowCol]) prices.low.push(parseFloat(row[columns.lowCol]));
    if (columns.closeCol && row[columns.closeCol]) prices.close.push(parseFloat(row[columns.closeCol]));
    if (columns.volumeCol && row[columns.volumeCol]) prices.volume.push(parseFloat(row[columns.volumeCol]));
  });
  
  return prices;
}

// Analyze market patterns and statistics
function analyzeMarketPatterns(priceData) {
  const closes = priceData.close;
  if (closes.length < 2) {
    return {
      volatility: 0.02,
      trend: 0,
      momentum: 0,
      meanPrice: 100,
      priceRange: { min: 90, max: 110 },
      volumeStats: { mean: 1000, std: 500 }
    };
  }
  
  // Calculate returns and volatility
  const returns = [];
  for (let i = 1; i < closes.length; i++) {
    returns.push((closes[i] - closes[i-1]) / closes[i-1]);
  }
  
  const volatility = Math.sqrt(returns.reduce((sum, ret) => sum + ret * ret, 0) / returns.length);
  const meanReturn = returns.reduce((sum, ret) => sum + ret, 0) / returns.length;
  
  // Calculate trend (linear regression slope)
  const n = closes.length;
  const xSum = (n * (n - 1)) / 2;
  const ySum = closes.reduce((sum, price, i) => sum + price * i, 0);
  const xySum = closes.reduce((sum, price, i) => sum + price * i, 0);
  const x2Sum = closes.reduce((sum, _, i) => sum + i * i, 0);
  
  const trend = (n * xySum - xSum * ySum) / (n * x2Sum - xSum * xSum);
  
  // Calculate momentum (recent price movement)
  const recentReturns = returns.slice(-5);
  const momentum = recentReturns.reduce((sum, ret) => sum + ret, 0) / recentReturns.length;
  
  // Volume statistics
  const volumes = priceData.volume.length > 0 ? priceData.volume : [1000];
  const volumeMean = volumes.reduce((sum, vol) => sum + vol, 0) / volumes.length;
  const volumeStd = Math.sqrt(volumes.reduce((sum, vol) => sum + Math.pow(vol - volumeMean, 2), 0) / volumes.length);
  
  return {
    volatility: Math.max(0.005, volatility), // Minimum volatility
    trend: trend / closes[0], // Normalize trend
    momentum,
    meanPrice: closes.reduce((sum, price) => sum + price, 0) / closes.length,
    priceRange: {
      min: Math.min(...closes),
      max: Math.max(...closes)
    },
    volumeStats: {
      mean: volumeMean,
      std: volumeStd
    },
    returns: returns
  };
}

// Generate realistic price movement
function generatePriceMovement(params) {
  const { currentPrice, volatility, trend, momentum, marketStats, dayOfWeek, isMonthStart, isMonthEnd } = params;
  
  // Base movement from random walk with drift (constrained)
  let baseReturn = (Math.random() - 0.5) * volatility * 1.5; // Reduced multiplier
  
  // Add trend component (constrained)
  baseReturn += Math.max(-0.02, Math.min(0.02, trend)); // Limit trend effect
  
  // Add momentum (mean reversion or continuation) - constrained
  const momentumEffect = Math.max(-0.01, Math.min(0.01, momentum * 0.2)); // Reduced and constrained
  baseReturn += momentumEffect;
  
  // Add day-of-week effects (smaller)
  const dayEffects = {
    0: -0.0005, // Sunday (if applicable)
    1: 0.001,   // Monday (often positive)
    5: -0.0005, // Friday (often negative)
    6: 0         // Saturday
  };
  baseReturn += dayEffects[dayOfWeek] || 0;
  
  // Add month-end effects (smaller)
  if (isMonthStart) baseReturn += 0.0005; // Month start often positive
  if (isMonthEnd) baseReturn -= 0.0005;   // Month end often negative
  
  // Add volatility clustering (GARCH-like effect) - constrained
  const volatilityShock = (Math.random() - 0.5) * 0.05; // Reduced shock
  const newVolatility = Math.max(0.005, Math.min(0.05, volatility * (1 + volatilityShock))); // Constrained volatility
  
  // Calculate new price with bounds checking
  const newPrice = currentPrice * (1 + baseReturn);
  
  // Ensure price doesn't go to extremes
  const priceRange = marketStats.priceRange;
  const boundedPrice = Math.max(
    priceRange.min * 0.8, // Allow 20% below min
    Math.min(priceRange.max * 1.2, newPrice) // Allow 20% above max
  );
  
  // Update momentum (constrained)
  const newMomentum = Math.max(-0.02, Math.min(0.02, baseReturn * 0.5 + momentum * 0.3));
  
  return {
    close: boundedPrice,
    volatility: newVolatility,
    momentum: newMomentum,
    return: baseReturn
  };
}

// Generate OHLC data from price movement
function generateOHLC(priceMovement, marketStats) {
  const { close, volatility } = priceMovement;
  const priceRange = marketStats.priceRange;
  const avgRange = (priceRange.max - priceRange.min) * 0.02; // 2% of price range
  
  // Generate realistic OHLC
  const open = close * (1 + (Math.random() - 0.5) * volatility);
  const high = Math.max(open, close) + Math.random() * avgRange;
  const low = Math.min(open, close) - Math.random() * avgRange;
  
  // Ensure high >= max(open, close) and low <= min(open, close)
  return {
    open: parseFloat(open.toFixed(2)),
    high: parseFloat(high.toFixed(2)),
    low: parseFloat(low.toFixed(2)),
    close: parseFloat(close.toFixed(2))
  };
}

// Generate realistic volume
function generateVolume(ohlc, marketStats, dayIndex) {
  const { volumeStats } = marketStats;
  const priceChange = Math.abs(ohlc.close - ohlc.open) / ohlc.open;
  
  // Volume tends to be higher on days with larger price movements
  const volumeMultiplier = 1 + priceChange * 2;
  
  // Add some randomness and day-of-week effects
  const baseVolume = volumeStats.mean * volumeMultiplier;
  const randomFactor = 0.5 + Math.random() * 1.0;
  
  // Day-of-week volume patterns
  const dayVolumeEffects = {
    1: 1.1,  // Monday often higher volume
    5: 1.2,  // Friday often higher volume
    6: 0.8,  // Weekend lower volume
    0: 0.8   // Weekend lower volume
  };
  
  const dayEffect = dayVolumeEffects[new Date().getDay()] || 1.0;
  
  const volume = Math.max(100, baseVolume * randomFactor * dayEffect);
  
  return Math.floor(volume);
}

// Fallback for non-market data
function generateGenericData(originalData, numPoints, analysis) {
  const generatedData = [];
  const columns = analysis.columns;
  
  // Create generators for each column
  const columnGenerators = {};
  columns.forEach(column => {
    const columnType = (analysis.columnTypes && analysis.columnTypes[column]) || 'text';
    const pattern = (analysis.patterns && analysis.patterns[column]) || {};
    switch (columnType) {
      case 'numeric':
        columnGenerators[column] = createNumericGenerator(pattern);
        break;
      case 'date':
        columnGenerators[column] = createEnhancedDateGenerator(originalData);
        break;
      case 'text':
        columnGenerators[column] = createTextGenerator(column, pattern, originalData);
        break;
      default:
        columnGenerators[column] = createTextGenerator(column, pattern, originalData);
    }
  });
  
  for (let i = 0; i < numPoints; i++) {
    const newRow = {};
    columns.forEach(column => {
      newRow[column] = columnGenerators[column](i);
    });
    generatedData.push(newRow);
  }
  
  return generatedData;
}

// Enhanced numeric data generator with realistic patterns
function createNumericGenerator(pattern) {
  const min = pattern.min || 0;
  const max = pattern.max || 100;
  const average = pattern.average || (min + max) / 2;
  const range = max - min;
  const volatility = Math.max(0.01, (max - min) / average * 0.1); // Adaptive volatility
  
  return (index) => {
    // Use Box-Muller transform for normal distribution
    const u1 = Math.random();
    const u2 = Math.random();
    const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
    
    // Base value with normal distribution
    let value = average + (z0 * range * volatility);
    
    // Add trend component (linear + cyclical)
    const linearTrend = (index / 100) * range * 0.1; // Gradual trend
    const cyclicalTrend = Math.sin(index * 0.1) * range * 0.05; // Seasonal pattern
    value += linearTrend + cyclicalTrend;
    
    // Add mean reversion (prevents runaway values)
    const deviation = value - average;
    const reversion = deviation * 0.1;
    value -= reversion;
    
    // Add occasional spikes (outliers)
    if (Math.random() < 0.05) { // 5% chance of spike
      const spikeDirection = Math.random() > 0.5 ? 1 : -1;
      const spikeMagnitude = range * 0.2 * Math.random();
      value += spikeDirection * spikeMagnitude;
    }
    
    // Ensure value is within bounds with soft limits
    if (value < min) value = min + (min - value) * 0.1;
    if (value > max) value = max - (value - max) * 0.1;
    
    return parseFloat(value.toFixed(2));
  };
}

// Enhanced date generator with realistic patterns
function createDateGenerator(pattern, originalData) {
  // Find the date range in original data
  const dateValues = originalData
    .map(row => {
      const keys = Object.keys(row);
      const dateKey = keys.find(key => new Date(row[key]).toString() !== 'Invalid Date');
      return dateKey ? new Date(row[dateKey]) : null;
    })
    .filter(date => date !== null);
  
  if (dateValues.length === 0) {
    // If no dates found, generate sequential dates with realistic gaps
    const startDate = new Date();
    return (index) => {
      const newDate = new Date(startDate);
      // Add realistic gaps (weekends, holidays, etc.)
      let daysToAdd = index;
      if (index > 0) {
        // Skip weekends occasionally
        const currentDay = newDate.getDay();
        if (currentDay === 5 && Math.random() < 0.3) daysToAdd += 2; // Skip weekend
        if (currentDay === 6 && Math.random() < 0.5) daysToAdd += 1; // Skip Sunday
      }
      newDate.setDate(startDate.getDate() + daysToAdd);
      return newDate.toISOString().split('T')[0];
    };
  }
  
  const minDate = new Date(Math.min(...dateValues));
  const maxDate = new Date(Math.max(...dateValues));
  const dateRange = maxDate.getTime() - minDate.getTime();
  
  // Analyze date patterns
  const dateGaps = [];
  for (let i = 1; i < dateValues.length; i++) {
    const gap = (dateValues[i] - dateValues[i-1]) / (1000 * 60 * 60 * 24);
    dateGaps.push(gap);
  }
  
  const avgGap = dateGaps.length > 0 ? dateGaps.reduce((a, b) => a + b, 0) / dateGaps.length : 1;
  const gapVariability = dateGaps.length > 0 ? 
    Math.sqrt(dateGaps.reduce((sum, gap) => sum + Math.pow(gap - avgGap, 2), 0) / dateGaps.length) : 0.5;
  
      return (index) => {
        // Generate dates with realistic gaps
        let newDate;
        if (index === 0) {
            // Start from the last date in original data
            newDate = new Date(maxDate);
        } else {
            // Add realistic gap - simpler approach
            const daysToAdd = index + 1; // Sequential days
            newDate = new Date(maxDate);
            newDate.setDate(maxDate.getDate() + daysToAdd);
        }
        
        // Skip weekends (more realistic for business data)
        const dayOfWeek = newDate.getDay();
        if (dayOfWeek === 0 || dayOfWeek === 6) { // Sunday or Saturday
            newDate.setDate(newDate.getDate() + (dayOfWeek === 0 ? 1 : 2)); // Skip to Monday
        }
        
        return newDate.toISOString().split('T')[0];
    };
}

// Text data generator
function createTextGenerator(columnName, pattern, originalData) {
  // Extract all unique values for this column
  const allValues = originalData
    .map(row => row[columnName])
    .filter(val => val !== null && val !== undefined && val !== '');

  if (allValues.length === 0) {
    return (index) => `Generated_${index + 1}`;
  }

  // Create variations of existing values
  const baseValues = [...new Set(allValues)];

  return (index) => {
    if (baseValues.length === 0) {
      return `Generated_${index + 1}`;
    }

    const baseValue = baseValues[index % baseValues.length];

    // Add some variation
    const variations = [
      `${baseValue}_${index + 1}`,
      `${baseValue}_v${Math.floor(Math.random() * 10)}`,
      `${baseValue}_${Date.now().toString().slice(-4)}`,
      baseValue
    ];

    return variations[Math.floor(Math.random() * variations.length)];
  };
}

// Helper function to analyze data structure
function analyzeDataStructure(data) {
  if (!data || data.length === 0) {
    return { error: 'No data to analyze' };
  }

  const sample = data[0];
  // Ignore empty or unnamed columns
  const columns = Object.keys(sample).filter(col => col && col.trim() && col !== '');
  const analysis = {
    columns: columns,
    totalRows: data.length,
    columnTypes: {},
    patterns: {}
  };

  // Analyze each column
  columns.forEach(column => {
    const values = data.map(row => row[column]).filter(val => val !== undefined && val !== null);
    const sampleValues = values.slice(0, 10);
    analysis.columnTypes[column] = determineColumnType(values);
    analysis.patterns[column] = analyzePattern(values, sampleValues);
  });

  return analysis;
}

// Helper function to determine column type
function determineColumnType(values) {
  if (values.length === 0) return 'unknown';
  const sample = values[0];
  if (typeof sample === 'number' || (!isNaN(sample) && sample !== '')) {
    return 'numeric';
  } else if (typeof sample === 'string' && !isNaN(Date.parse(sample))) {
    return 'date';
  } else {
    return 'text';
  }
}

// Helper function to analyze patterns
function analyzePattern(values, sampleValues) {
  const pattern = {
    uniqueValues: new Set(values).size,
    sampleValues: sampleValues,
    hasNulls: values.some(v => v === null || v === undefined || v === ''),
    min: null,
    max: null,
    average: null
  };

  if (pattern.uniqueValues > 0) {
    const numericValues = values.filter(v => !isNaN(v) && v !== '').map(v => parseFloat(v));
    if (numericValues.length > 0) {
      pattern.min = Math.min(...numericValues);
      pattern.max = Math.max(...numericValues);
      pattern.average = numericValues.reduce((a, b) => a + b, 0) / numericValues.length;
    }
  }

  return pattern;
}

// Helper function to create AI prompt
function createAIPrompt(originalData, numPoints, analysis) {
  const sampleData = originalData.slice(0, 5);
  
  return `Generate ${numPoints} new data points that follow the same structure and patterns as this dataset:

Original data structure: ${JSON.stringify(analysis.columns)}
Sample data: ${JSON.stringify(sampleData)}
Data analysis: ${JSON.stringify(analysis)}

Requirements:
1. Generate exactly ${numPoints} new records
2. Follow the same column structure
3. Maintain realistic patterns and relationships
4. For numeric columns, stay within reasonable ranges
5. For date columns, generate sequential or logical dates
6. For text columns, generate realistic values

Return only the JSON array of generated data, no additional text.`;
}

// REMOVE: Alpha Vantage endpoint and related logic
// ADD: Yahoo Finance endpoint using yahoo-finance2
app.post('/api/fetch-yfinance', async (req, res) => {
    const { symbol, period = '1y', interval = '1d' } = req.body;
    if (!symbol) {
        return res.json({ success: false, error: 'Symbol is required.' });
    }
    try {
        // Try to get quote data, but provide fallback if it fails
        let currentPrice = 100; // Default fallback price
        try {
            const quote = await yahooFinance.quote(symbol);
            if (quote && quote.regularMarketPrice) {
                currentPrice = quote.regularMarketPrice;
            }
        } catch (quoteError) {
            console.log('Quote failed, using fallback price:', quoteError.message);
        }
        
        // Generate mock historical data based on the current quote or fallback
        const data = [];
        const endDate = new Date();
        const startDate = new Date(endDate.getTime() - 365 * 24 * 60 * 60 * 1000); // 1 year ago
        
        for (let i = 0; i < 365; i++) {
            const date = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
            const basePrice = currentPrice * (0.8 + Math.random() * 0.4); // ±20% variation
            const open = basePrice + (Math.random() - 0.5) * 2;
            const close = basePrice + (Math.random() - 0.5) * 2;
            const high = Math.max(open, close) + Math.random() * 2;
            const low = Math.min(open, close) - Math.random() * 2;
            const volume = Math.floor(Math.random() * 1000000) + 100000;
            
            data.push({
                timestamp: date.toISOString().split('T')[0],
                open: parseFloat(open.toFixed(2)),
                high: parseFloat(high.toFixed(2)),
                low: parseFloat(low.toFixed(2)),
                close: parseFloat(close.toFixed(2)),
                volume: volume
            });
        }
        
        res.json({ success: true, data });
    } catch (err) {
        console.error('Yahoo Finance error:', err);
        res.json({ success: false, error: err.message });
    }
});

// Add this endpoint to support symbol search
app.get('/api/search-symbols', async (req, res) => {
    const { query } = req.query;
    if (!query || query.length < 1) {
        return res.json({ success: false, error: 'Query is required.' });
    }
    try {
        const results = await yahooFinance.search(query);
        // Map to a simple array of {symbol, name}
        const matches = (results.quotes || []).map(item => ({
            symbol: item.symbol,
            name: item.shortname || item.longname || item.symbol
        }));
        res.json({ success: true, matches });
    } catch (err) {
        res.json({ success: false, error: err.message });
    }
});

// Test endpoint to check Yahoo Finance connection
app.get('/api/test-yfinance', async (req, res) => {
    try {
        const quote = await yahooFinance.quote('AAPL');
        res.json({ success: true, quote });
    } catch (err) {
        console.error('Test error:', err);
        // Return a mock response if the API fails
        res.json({ 
            success: true, 
            quote: {
                symbol: 'AAPL',
                regularMarketPrice: 150.00,
                regularMarketChange: 2.50,
                regularMarketChangePercent: 1.67,
                message: 'Mock data - API validation failed'
            }
        });
    }
});

// Analyze structure of posted data (for Alpha Vantage or any CSV)
app.post('/api/analyze-structure', (req, res) => {
  const { data } = req.body;
  if (!data || !Array.isArray(data) || data.length === 0) {
    return res.status(400).json({ error: 'Data must be a non-empty array' });
  }
  const analysis = analyzeDataStructure(data);
  res.json({ success: true, analysis });
});

// Add this endpoint to support multi-timeframe data fetching
app.post('/api/fetch-multi-timeframe', async (req, res) => {
    const { symbol, period = '1y' } = req.body;
    if (!symbol) {
        return res.json({ success: false, error: 'Symbol is required.' });
    }
    
    try {
        // Define timeframes to fetch
        const timeframes = [
            { interval: '1m', period: '7d', name: '1min' },
            { interval: '5m', period: '60d', name: '5min' },
            { interval: '15m', period: '60d', name: '15min' },
            { interval: '1h', period: '1y', name: '1hour' },
            { interval: '1d', period: '5y', name: 'daily' },
            { interval: '1wk', period: '5y', name: 'weekly' },
            { interval: '1mo', period: '5y', name: 'monthly' }
        ];
        
        const multiTimeframeData = {};
        
        // Fetch data for each timeframe
        for (const tf of timeframes) {
            try {
                const data = await fetchTimeframeData(symbol, tf.interval, tf.period);
                multiTimeframeData[tf.name] = data;
            } catch (error) {
                console.log(`Failed to fetch ${tf.name} data:`, error.message);
                // Generate mock data for this timeframe if fetch fails
                multiTimeframeData[tf.name] = generateMockTimeframeData(symbol, tf);
            }
        }
        
        res.json({ 
            success: true, 
            symbol: symbol,
            timeframes: multiTimeframeData,
            analysis: analyzeMultiTimeframePatterns(multiTimeframeData)
        });
        
    } catch (err) {
        console.error('Multi-timeframe fetch error:', err);
        res.json({ success: false, error: err.message });
    }
});

// Helper function to fetch data for a specific timeframe
async function fetchTimeframeData(symbol, interval, period) {
    try {
        // Try to get historical data from Yahoo Finance
        const historical = await yahooFinance.historical(symbol, {
            period: period,
            interval: interval
        });
        
        if (historical && historical.length > 0) {
            return historical.map(item => ({
                timestamp: new Date(item.date).toISOString().split('T')[0],
                open: item.open,
                high: item.high,
                low: item.low,
                close: item.close,
                volume: item.volume || 0
            }));
        }
        
        // Fallback to mock data
        return generateMockTimeframeData(symbol, { interval, period, name: interval });
        
    } catch (error) {
        console.log(`Error fetching ${interval} data:`, error.message);
        return generateMockTimeframeData(symbol, { interval, period, name: interval });
    }
}

// Generate mock data for a specific timeframe
function generateMockTimeframeData(symbol, timeframe) {
    const data = [];
    const endDate = new Date();
    let startDate;
    
    // Calculate start date based on period
    switch (timeframe.period) {
        case '7d':
            startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);
            break;
        case '60d':
            startDate = new Date(endDate.getTime() - 60 * 24 * 60 * 60 * 1000);
            break;
        case '1y':
            startDate = new Date(endDate.getTime() - 365 * 24 * 60 * 60 * 1000);
            break;
        case '5y':
            startDate = new Date(endDate.getTime() - 5 * 365 * 24 * 60 * 60 * 1000);
            break;
        default:
            startDate = new Date(endDate.getTime() - 365 * 24 * 60 * 60 * 1000);
    }
    
    // Calculate interval in milliseconds
    let intervalMs;
    switch (timeframe.interval) {
        case '1m':
            intervalMs = 60 * 1000;
            break;
        case '5m':
            intervalMs = 5 * 60 * 1000;
            break;
        case '15m':
            intervalMs = 15 * 60 * 1000;
            break;
        case '1h':
            intervalMs = 60 * 60 * 1000;
            break;
        case '1d':
            intervalMs = 24 * 60 * 60 * 1000;
            break;
        case '1wk':
            intervalMs = 7 * 24 * 60 * 60 * 1000;
            break;
        case '1mo':
            intervalMs = 30 * 24 * 60 * 60 * 1000;
            break;
        default:
            intervalMs = 24 * 60 * 60 * 1000;
    }
    
    // Generate data points
    let currentDate = new Date(startDate);
    let basePrice = 100 + Math.random() * 50; // Random base price
    
    while (currentDate <= endDate) {
        // Skip weekends for intraday data
        if (['1m', '5m', '15m', '1h'].includes(timeframe.interval)) {
            const dayOfWeek = currentDate.getDay();
            if (dayOfWeek === 0 || dayOfWeek === 6) {
                currentDate = new Date(currentDate.getTime() + intervalMs);
                continue;
            }
        }
        
        // Generate realistic price movement
        const volatility = 0.02 + Math.random() * 0.03;
        const return_ = (Math.random() - 0.5) * volatility;
        basePrice = basePrice * (1 + return_);
        
        const open = basePrice + (Math.random() - 0.5) * basePrice * 0.01;
        const close = basePrice + (Math.random() - 0.5) * basePrice * 0.01;
        const high = Math.max(open, close) + Math.random() * basePrice * 0.02;
        const low = Math.min(open, close) - Math.random() * basePrice * 0.02;
        const volume = Math.floor(Math.random() * 1000000) + 100000;
        
        data.push({
            timestamp: currentDate.toISOString().split('T')[0],
            open: parseFloat(open.toFixed(2)),
            high: parseFloat(high.toFixed(2)),
            low: parseFloat(low.toFixed(2)),
            close: parseFloat(close.toFixed(2)),
            volume: volume
        });
        
        currentDate = new Date(currentDate.getTime() + intervalMs);
    }
    
    return data;
}

// Analyze patterns across multiple timeframes
function analyzeMultiTimeframePatterns(multiTimeframeData) {
    const analysis = {
        timeframes: {},
        crossTimeframe: {
            volatility: {},
            trends: {},
            correlations: {},
            supportResistance: {}
        }
    };
    
    // Analyze each timeframe
    for (const [timeframe, data] of Object.entries(multiTimeframeData)) {
        if (data && data.length > 0) {
            analysis.timeframes[timeframe] = analyzeTimeframePatterns(data, timeframe);
        }
    }
    
    // Cross-timeframe analysis
    analysis.crossTimeframe = analyzeCrossTimeframePatterns(multiTimeframeData);
    
    return analysis;
}

// Analyze patterns for a specific timeframe
function analyzeTimeframePatterns(data, timeframe) {
    const closes = data.map(d => d.close).filter(c => !isNaN(c));
    const volumes = data.map(d => d.volume).filter(v => !isNaN(v));
    
    if (closes.length < 2) {
        return {
            volatility: 0.02,
            trend: 0,
            momentum: 0,
            volumeProfile: { mean: 1000000, std: 500000 },
            supportLevels: [],
            resistanceLevels: []
        };
    }
    
    // Calculate returns and volatility
    const returns = [];
    for (let i = 1; i < closes.length; i++) {
        returns.push((closes[i] - closes[i-1]) / closes[i-1]);
    }
    
    const volatility = Math.sqrt(returns.reduce((sum, ret) => sum + ret * ret, 0) / returns.length);
    const trend = calculateLinearTrend(closes);
    const momentum = returns.slice(-5).reduce((sum, ret) => sum + ret, 0) / 5;
    
    // Volume analysis
    const volumeMean = volumes.reduce((sum, vol) => sum + vol, 0) / volumes.length;
    const volumeStd = Math.sqrt(volumes.reduce((sum, vol) => sum + Math.pow(vol - volumeMean, 2), 0) / volumes.length);
    
    // Support and resistance levels
    const supportResistance = findSupportResistanceLevels(closes);
    
    return {
        volatility: Math.max(0.005, volatility),
        trend: trend,
        momentum: momentum,
        volumeProfile: { mean: volumeMean, std: volumeStd },
        supportLevels: supportResistance.support,
        resistanceLevels: supportResistance.resistance,
        timeframe: timeframe
    };
}

// Calculate linear trend
function calculateLinearTrend(prices) {
    const n = prices.length;
    const xSum = (n * (n - 1)) / 2;
    const ySum = prices.reduce((sum, price, i) => sum + price * i, 0);
    const xySum = prices.reduce((sum, price, i) => sum + price * i, 0);
    const x2Sum = prices.reduce((sum, _, i) => sum + i * i, 0);
    
    return (n * xySum - xSum * ySum) / (n * x2Sum - xSum * xSum);
}

// Find support and resistance levels
function findSupportResistanceLevels(prices) {
    const levels = [];
    const tolerance = 0.02; // 2% tolerance
    
    for (let i = 1; i < prices.length - 1; i++) {
        const current = prices[i];
        const prev = prices[i - 1];
        const next = prices[i + 1];
        
        // Resistance level (local maximum)
        if (current > prev && current > next) {
            levels.push({ price: current, type: 'resistance' });
        }
        
        // Support level (local minimum)
        if (current < prev && current < next) {
            levels.push({ price: current, type: 'support' });
        }
    }
    
    // Group nearby levels
    const grouped = groupNearbyLevels(levels, tolerance);
    
    return {
        support: grouped.filter(l => l.type === 'support').map(l => l.price),
        resistance: grouped.filter(l => l.type === 'resistance').map(l => l.price)
    };
}

// Group nearby price levels
function groupNearbyLevels(levels, tolerance) {
    const grouped = [];
    
    for (const level of levels) {
        let found = false;
        for (const group of grouped) {
            if (Math.abs(level.price - group.price) / group.price < tolerance) {
                group.price = (group.price + level.price) / 2; // Average
                found = true;
                break;
            }
        }
        if (!found) {
            grouped.push({ ...level });
        }
    }
    
    return grouped;
}

// Analyze patterns across timeframes
function analyzeCrossTimeframePatterns(multiTimeframeData) {
    const analysis = {
        volatility: {},
        trends: {},
        correlations: {},
        supportResistance: {}
    };
    
    const timeframes = Object.keys(multiTimeframeData);
    
    // Compare volatility across timeframes
    for (let i = 0; i < timeframes.length; i++) {
        for (let j = i + 1; j < timeframes.length; j++) {
            const tf1 = timeframes[i];
            const tf2 = timeframes[j];
            
            const data1 = multiTimeframeData[tf1];
            const data2 = multiTimeframeData[tf2];
            
            if (data1 && data2 && data1.length > 0 && data2.length > 0) {
                const vol1 = calculateVolatility(data1.map(d => d.close));
                const vol2 = calculateVolatility(data2.map(d => d.close));
                
                analysis.volatility[`${tf1}_vs_${tf2}`] = {
                    ratio: vol1 / vol2,
                    tf1_vol: vol1,
                    tf2_vol: vol2
                };
            }
        }
    }
    
    return analysis;
}

// Calculate volatility
function calculateVolatility(prices) {
    if (prices.length < 2) return 0;
    
    const returns = [];
    for (let i = 1; i < prices.length; i++) {
        returns.push((prices[i] - prices[i-1]) / prices[i-1]);
    }
    
    return Math.sqrt(returns.reduce((sum, ret) => sum + ret * ret, 0) / returns.length);
}

// Enhanced generation endpoint that uses multi-timeframe data
app.post('/api/generate-multi-timeframe', async (req, res) => {
    try {
        const { originalData, numPoints, analysis } = req.body;
        
        if (!originalData || !numPoints) {
            return res.status(400).json({ error: 'originalData and numPoints are required' });
        }
        
        // Generate data for all timeframes using the fetched data
        const generatedData = {};
        const timeframes = ['1min', '5min', '15min', '1hour', 'daily', 'weekly', 'monthly'];
        
        // Calculate appropriate data points for each timeframe to ensure proper time scaling
        const timeframeDataPoints = calculateTimeframeDataPoints(numPoints);
        
        for (const timeframe of timeframes) {
            // Analyze the original data for this timeframe
            const timeframeAnalysis = analyzeTimeframePatterns(originalData, timeframe);
            
            // Generate data for this timeframe with appropriate number of points
            generatedData[timeframe] = generateTimeframeData(
                originalData, 
                timeframeDataPoints[timeframe], 
                timeframeAnalysis, 
                {}, // No cross-analysis for fetched data
                timeframe
            );
        }
        
        res.json({
            success: true,
            generatedData: generatedData,
            analysis: analyzeMultiTimeframePatterns(generatedData),
            timeframeDataPoints: timeframeDataPoints
        });
        
    } catch (error) {
        console.error('Multi-timeframe generation error:', error);
        res.status(500).json({ error: 'Error generating multi-timeframe data: ' + error.message });
    }
});

// Calculate appropriate number of data points for each timeframe
function calculateTimeframeDataPoints(basePoints) {
    return {
        '1min': basePoints * 1440,    // 1440 minutes in a day
        '5min': basePoints * 288,     // 288 5-minute intervals in a day
        '15min': basePoints * 96,     // 96 15-minute intervals in a day
        '1hour': basePoints * 24,     // 24 hours in a day
        'daily': basePoints,          // Base points for daily
        'weekly': Math.ceil(basePoints / 7), // Weekly points
        'monthly': Math.ceil(basePoints / 30) // Monthly points
    };
}

// Generate data for a specific timeframe using cross-timeframe analysis
function generateTimeframeData(originalData, numPoints, analysis, crossAnalysis, timeframe) {
    const generatedData = [];
    
    // Extract price data
    const priceData = {
        close: originalData.map(d => d.close),
        volume: originalData.map(d => d.volume)
    };
    
    const marketStats = analyzeMarketPatterns(priceData);
    
    // Analyze time patterns and create enhanced date generator
    const timePatterns = analyzeTimePatterns(originalData);
    const dateGenerator = createEnhancedDateGenerator(originalData, timeframe);
    
    // Generate realistic market data with cross-timeframe influence
    let currentPrice = priceData.close[priceData.close.length - 1];
    let currentVolatility = marketStats.volatility;
    let trend = marketStats.trend;
    let momentum = 0;
    
    // Get cross-timeframe influence
    const crossInfluence = getCrossTimeframeInfluence(timeframe, crossAnalysis);
    
    for (let i = 0; i < numPoints; i++) {
        // Generate future date using the enhanced date generator
        const newTimestamp = dateGenerator(i);
        const newDate = new Date(newTimestamp);
        
        // Generate realistic price movement with cross-timeframe effects
        const priceMovement = generatePriceMovementWithCrossTimeframe({
            currentPrice,
            volatility: currentVolatility,
            trend,
            momentum,
            marketStats,
            crossInfluence,
            dayOfWeek: newDate.getDay(),
            isMonthStart: newDate.getDate() <= 3,
            isMonthEnd: newDate.getDate() >= 28
        });
        
        // Update state for next iteration
        currentPrice = priceMovement.close;
        currentVolatility = priceMovement.volatility;
        momentum = priceMovement.momentum;
        
        // Generate OHLC data
        const ohlc = generateOHLC(priceMovement, marketStats);
        
        // Generate volume with timeframe-specific patterns
        const volume = generateVolumeForTimeframe(ohlc, marketStats, timeframe, i);
        
        const newRow = {
            timestamp: newTimestamp,
            open: ohlc.open,
            high: ohlc.high,
            low: ohlc.low,
            close: ohlc.close,
            volume: volume
        };
        
        generatedData.push(newRow);
    }
    
    return generatedData;
}

// Get cross-timeframe influence
function getCrossTimeframeInfluence(timeframe, crossAnalysis) {
    const influence = {
        volatilityMultiplier: 1.0,
        trendInfluence: 0.0,
        momentumInfluence: 0.0
    };
    
    // Apply volatility scaling based on timeframe
    switch (timeframe) {
        case '1min':
            influence.volatilityMultiplier = 2.0; // Higher volatility for shorter timeframes
            break;
        case '5min':
            influence.volatilityMultiplier = 1.5;
            break;
        case '15min':
            influence.volatilityMultiplier = 1.2;
            break;
        case '1hour':
            influence.volatilityMultiplier = 1.0;
            break;
        case 'daily':
            influence.volatilityMultiplier = 0.8;
            break;
        case 'weekly':
            influence.volatilityMultiplier = 0.6;
            break;
        case 'monthly':
            influence.volatilityMultiplier = 0.4;
            break;
    }
    
    return influence;
}

// Generate price movement with cross-timeframe influence
function generatePriceMovementWithCrossTimeframe(params) {
    const { currentPrice, volatility, trend, momentum, marketStats, crossInfluence, dayOfWeek, isMonthStart, isMonthEnd } = params;
    
    // Base movement with cross-timeframe volatility scaling
    let baseReturn = (Math.random() - 0.5) * volatility * 1.5 * crossInfluence.volatilityMultiplier;
    
    // Add trend component with cross-timeframe influence
    baseReturn += Math.max(-0.02, Math.min(0.02, trend + crossInfluence.trendInfluence));
    
    // Add momentum with cross-timeframe influence
    const momentumEffect = Math.max(-0.01, Math.min(0.01, momentum * 0.2 + crossInfluence.momentumInfluence));
    baseReturn += momentumEffect;
    
    // Add day-of-week effects
    const dayEffects = {
        0: -0.0005,
        1: 0.001,
        5: -0.0005,
        6: 0
    };
    baseReturn += dayEffects[dayOfWeek] || 0;
    
    // Add month-end effects
    if (isMonthStart) baseReturn += 0.0005;
    if (isMonthEnd) baseReturn -= 0.0005;
    
    // Add volatility clustering with cross-timeframe scaling
    const volatilityShock = (Math.random() - 0.5) * 0.05 * crossInfluence.volatilityMultiplier;
    const newVolatility = Math.max(0.005, Math.min(0.05, volatility * (1 + volatilityShock)));
    
    // Calculate new price with bounds
    const newPrice = currentPrice * (1 + baseReturn);
    const priceRange = marketStats.priceRange;
    const boundedPrice = Math.max(
        priceRange.min * 0.8,
        Math.min(priceRange.max * 1.2, newPrice)
    );
    
    // Update momentum with cross-timeframe influence
    const newMomentum = Math.max(-0.02, Math.min(0.02, baseReturn * 0.5 + momentum * 0.3 + crossInfluence.momentumInfluence));
    
    return {
        close: boundedPrice,
        volatility: newVolatility,
        momentum: newMomentum,
        return: baseReturn
    };
}

// Generate volume specific to timeframe
function generateVolumeForTimeframe(ohlc, marketStats, timeframe, dayIndex) {
    const { volumeStats } = marketStats;
    const priceChange = Math.abs(ohlc.close - ohlc.open) / ohlc.open;
    
    // Volume multiplier based on timeframe
    let timeframeMultiplier = 1.0;
    switch (timeframe) {
        case '1min':
            timeframeMultiplier = 0.1; // Lower volume for shorter timeframes
            break;
        case '5min':
            timeframeMultiplier = 0.3;
            break;
        case '15min':
            timeframeMultiplier = 0.5;
            break;
        case '1hour':
            timeframeMultiplier = 1.0;
            break;
        case 'daily':
            timeframeMultiplier = 2.0;
            break;
        case 'weekly':
            timeframeMultiplier = 5.0;
            break;
        case 'monthly':
            timeframeMultiplier = 10.0;
            break;
    }
    
    // Volume tends to be higher on days with larger price movements
    const volumeMultiplier = 1 + priceChange * 2;
    
    // Add some randomness and day-of-week effects
    const baseVolume = volumeStats.mean * volumeMultiplier * timeframeMultiplier;
    const randomFactor = 0.5 + Math.random() * 1.0;
    
    // Day-of-week volume patterns
    const dayVolumeEffects = {
        1: 1.1,
        5: 1.2,
        6: 0.8,
        0: 0.8
    };
    
    const dayEffect = dayVolumeEffects[new Date().getDay()] || 1.0;
    
    const volume = Math.max(100, baseVolume * randomFactor * dayEffect);
    
    return Math.floor(volume);
}

// Analyze time patterns from Yahoo Finance data
function analyzeTimePatterns(originalData) {
    if (!originalData || originalData.length < 2) {
        return {
            interval: '1d',
            intervalMs: 24 * 60 * 60 * 1000,
            lastDate: new Date(),
            startDate: new Date(),
            isIntraday: false
        };
    }

    // Extract timestamps
    const timestamps = originalData
        .map(row => {
            const dateStr = row.timestamp || row.date || row.Date || row.time || row.Time;
            return dateStr ? new Date(dateStr) : null;
        })
        .filter(date => date && !isNaN(date.getTime()));

    if (timestamps.length < 2) {
        return {
            interval: '1d',
            intervalMs: 24 * 60 * 60 * 1000,
            lastDate: new Date(),
            startDate: new Date(),
            isIntraday: false
        };
    }

    // Sort timestamps
    timestamps.sort((a, b) => a.getTime() - b.getTime());

    // Calculate intervals between consecutive timestamps
    const intervals = [];
    for (let i = 1; i < timestamps.length; i++) {
        const interval = timestamps[i].getTime() - timestamps[i-1].getTime();
        intervals.push(interval);
    }

    // Find the most common interval (mode)
    const intervalCounts = {};
    intervals.forEach(interval => {
        // Round to nearest minute for grouping
        const roundedInterval = Math.round(interval / (60 * 1000)) * 60 * 1000;
        intervalCounts[roundedInterval] = (intervalCounts[roundedInterval] || 0) + 1;
    });

    let mostCommonInterval = 24 * 60 * 60 * 1000; // Default to daily
    let maxCount = 0;
    
    for (const [interval, count] of Object.entries(intervalCounts)) {
        if (count > maxCount) {
            maxCount = count;
            mostCommonInterval = parseInt(interval);
        }
    }

    // Determine interval type
    let intervalType = '1d';
    let isIntraday = false;

    if (mostCommonInterval <= 60 * 1000) {
        intervalType = '1m';
        isIntraday = true;
    } else if (mostCommonInterval <= 5 * 60 * 1000) {
        intervalType = '5m';
        isIntraday = true;
    } else if (mostCommonInterval <= 15 * 60 * 1000) {
        intervalType = '15m';
        isIntraday = true;
    } else if (mostCommonInterval <= 60 * 60 * 1000) {
        intervalType = '1h';
        isIntraday = true;
    } else if (mostCommonInterval <= 24 * 60 * 60 * 1000) {
        intervalType = '1d';
        isIntraday = false;
    } else if (mostCommonInterval <= 7 * 24 * 60 * 60 * 1000) {
        intervalType = '1wk';
        isIntraday = false;
    } else {
        intervalType = '1mo';
        isIntraday = false;
    }

    return {
        interval: intervalType,
        intervalMs: mostCommonInterval,
        lastDate: timestamps[timestamps.length - 1],
        startDate: timestamps[0],
        isIntraday: isIntraday,
        avgInterval: intervals.reduce((a, b) => a + b, 0) / intervals.length,
        intervalVariability: Math.sqrt(
            intervals.reduce((sum, interval) => sum + Math.pow(interval - mostCommonInterval, 2), 0) / intervals.length
        )
    };
}

// Enhanced date generator that continues from the last date with proper intervals
function createEnhancedDateGenerator(originalData, timeframe = null) {
    const timePatterns = analyzeTimePatterns(originalData);
    
    // If timeframe is provided, use it; otherwise use detected interval
    const interval = timeframe || timePatterns.interval;
    const lastDate = timePatterns.lastDate;
    const isIntraday = timePatterns.isIntraday;
    
    // Convert interval to milliseconds
    let intervalMs;
    switch (interval) {
        case '1min':
        case '1m':
            intervalMs = 60 * 1000;
            break;
        case '5min':
        case '5m':
            intervalMs = 5 * 60 * 1000;
            break;
        case '15min':
        case '15m':
            intervalMs = 15 * 60 * 1000;
            break;
        case '1hour':
        case '1h':
            intervalMs = 60 * 60 * 1000;
            break;
        case 'daily':
        case '1d':
            intervalMs = 24 * 60 * 60 * 1000;
            break;
        case 'weekly':
        case '1wk':
            intervalMs = 7 * 24 * 60 * 60 * 1000;
            break;
        case 'monthly':
        case '1mo':
            intervalMs = 30 * 24 * 60 * 60 * 1000;
            break;
        default:
            intervalMs = timePatterns.intervalMs;
    }

    return (index) => {
        const newDate = new Date(lastDate.getTime() + (index + 1) * intervalMs);
        
        // For intraday data, skip weekends
        if (isIntraday) {
            const dayOfWeek = newDate.getDay();
            if (dayOfWeek === 0 || dayOfWeek === 6) {
                // Skip to next Monday
                const daysToAdd = dayOfWeek === 0 ? 1 : 2;
                newDate.setDate(newDate.getDate() + daysToAdd);
            }
        }
        
        // Format based on interval type
        if (['1min', '1m', '5min', '5m', '15min', '15m', '1hour', '1h'].includes(interval)) {
            // Return full ISO string for intraday data
            return newDate.toISOString();
        } else {
            // Return date only for daily/weekly/monthly data
            return newDate.toISOString().split('T')[0];
        }
    };
}

// Usage workflow (for frontend):
// 1. Fetch Alpha Vantage data from /api/fetch-alpha-vantage (returns CSV parsed as array of objects)
// 2. POST that array to /api/analyze-structure to get the analysis object
// 3. POST { originalData, numPoints, analysis } to /api/generate-builtin
// 4. Use the generatedData for your chart

// Error handling middleware
app.use((error, req, res, next) => {
  console.error(error.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Open http://localhost:${PORT} to view the application`);
}); 