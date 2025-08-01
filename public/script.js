// Global variables
let originalData = [];
let generatedData = [];
let combinedData = [];
let dataAnalysis = {};
let chart = null;
let selectedMethod = 'ai'; // Default to AI generation
let selectedTimeframe = 'daily'; // Default to daily timeframe
let playbackIndex = 0;
let playbackTimer = null;
let playbackSpeed = 500; // ms per step
let isPlaying = false;
let plotlyLayout = null;
let plotlyConfig = {responsive: true, displayModeBar: false};

// TradingView Lightweight Chart globals
let tvChart = null;
let tvLineSeries = null;

// Data transformation globals
let transformedData = [];
let dataTransformationInfo = {};

// Multi-timeframe data
let multiTimeframeData = {};
let currentTimeframeData = null;
let allTimeframeData = {}; // Stores data for all timeframes
let playbackData = {}; // Stores playback data for each timeframe

// DOM elements
const generateBtn = document.getElementById('generateBtn');
const loading = document.getElementById('loading');
const loadingText = document.getElementById('loadingText');
const dataStats = document.getElementById('dataStats');
const dataPreview = document.getElementById('dataPreview');
const dataTable = document.getElementById('dataTable');
const chartType = document.getElementById('chartType');
const xAxis = document.getElementById('xAxis');
const yAxis = document.getElementById('yAxis');
const updateChartBtn = document.getElementById('updateChartBtn');
const numPoints = document.getElementById('numPoints');
const xTickInterval = document.getElementById('xTickInterval');

// Playback DOM elements
const playPauseBtn = document.getElementById('playPauseBtn');
const playbackSlider = document.getElementById('playbackSlider');
const playbackIndexLabel = document.getElementById('playbackIndexLabel');

// Event listeners
let allSymbols = [];
let filteredSymbols = [];
let selectedSymbol = null;
const alphaSymbolSearch = document.getElementById('alphaSymbolSearch');
const alphaSymbolDropdown = document.getElementById('alphaSymbolDropdown');
const fetchAlphaBtn = document.getElementById('fetchAlphaBtn');
const alphaVantageAlert = document.getElementById('alphaVantageAlert');

// Remove Alpha Vantage variables
// Add yfinance variables
const yfinanceSymbol = document.getElementById('yfinanceSymbol');
const fetchYFinanceBtn = document.getElementById('fetchYFinanceBtn');
const yfinanceAlert = document.getElementById('yfinanceAlert');
// Remove symbolSearch variable and logic
// Use yfinanceSymbol for search/autocomplete
const symbolDropdown = document.getElementById('symbolDropdown');
let searchTimeout = null;

// Load symbols.json on DOMContentLoaded
async function loadSymbolsList() {
    try {
        const res = await fetch('symbols.json');
        allSymbols = await res.json();
    } catch (e) {
        showAlphaVantageAlert('Failed to load stock symbol list.', 'error');
        allSymbols = [];
    }
}

document.addEventListener('DOMContentLoaded', function() {
    loadSymbolsList();
    setupEventListeners();
    selectMethod('ai');
    selectTimeframe('daily'); // Set default timeframe
});

function setupEventListeners() {
    // Generate button
    generateBtn.addEventListener('click', generateNewData);

    // Chart controls (removed chart options, so skip these)
    // if (updateChartBtn) updateChartBtn.addEventListener('click', updateChart);
    // if (chartType) chartType.addEventListener('change', updateChart);
    // if (xAxis) xAxis.addEventListener('change', updateChart);
    // if (yAxis) yAxis.addEventListener('change', updateChart);
    // if (xTickInterval) xTickInterval.addEventListener('input', updateChart);

    if (playPauseBtn && playbackSlider) {
        playPauseBtn.addEventListener('click', togglePlayback);
        playbackSlider.addEventListener('input', handleSliderChange);
    }

    // Alpha Vantage search and dropdown
    if (alphaSymbolSearch) {
        alphaSymbolSearch.addEventListener('input', handleSymbolSearchInput);
    }
    if (alphaSymbolDropdown) {
        alphaSymbolDropdown.addEventListener('change', handleSymbolDropdownChange);
        alphaSymbolDropdown.addEventListener('dblclick', () => {
            if (fetchAlphaBtn && !fetchAlphaBtn.disabled) fetchAlphaBtn.click();
        });
    }
    if (fetchAlphaBtn) {
        fetchAlphaBtn.addEventListener('click', fetchAlphaVantageData);
    }

    // yFinance fetch
    if (fetchYFinanceBtn) {
        fetchYFinanceBtn.addEventListener('click', fetchYFinanceData);
    }

    // Symbol search integrated into yfinanceSymbol
    if (yfinanceSymbol) {
        yfinanceSymbol.addEventListener('input', async function() {
            const query = yfinanceSymbol.value.trim();
            if (searchTimeout) clearTimeout(searchTimeout);
            if (!query) {
                symbolDropdown.style.display = 'none';
                return;
            }
            searchTimeout = setTimeout(async () => {
                const res = await fetch(`/api/search-symbols?query=${encodeURIComponent(query)}`);
                const data = await res.json();
                if (data.success && data.matches.length > 0) {
                    symbolDropdown.innerHTML = '';
                    data.matches.forEach(match => {
                        const li = document.createElement('li');
                        li.textContent = `${match.symbol} - ${match.name}`;
                        li.style.padding = '8px 12px';
                        li.style.cursor = 'pointer';
                        li.addEventListener('click', () => {
                            yfinanceSymbol.value = match.symbol;
                            symbolDropdown.style.display = 'none';
                        });
                        symbolDropdown.appendChild(li);
                    });
                    symbolDropdown.style.display = 'block';
                } else {
                    symbolDropdown.style.display = 'none';
                }
            }, 300); // debounce
        });
        document.addEventListener('click', (e) => {
            if (e.target !== yfinanceSymbol) {
                symbolDropdown.style.display = 'none';
            }
        });
    }
}

// Method selection function
function selectMethod(method) {
    selectedMethod = method;
    
    // Update UI
    document.querySelectorAll('.method-option').forEach(option => {
        option.classList.remove('selected');
    });
    
    if (method === 'ai') {
        document.getElementById('aiMethod').classList.add('selected');
    } else {
        document.getElementById('builtinMethod').classList.add('selected');
    }
    
    // Show/hide timeframe selector based on method
    const timeframeSection = document.getElementById('timeframeSection');
    if (method === 'builtin') {
        timeframeSection.style.display = 'block';
    } else {
        timeframeSection.style.display = 'none';
    }
}

function selectTimeframe(timeframe) {
    selectedTimeframe = timeframe;
    
    // Update UI
    document.querySelectorAll('.timeframe-option').forEach(option => {
        option.classList.remove('selected');
    });
    
    const timeframeElement = document.getElementById(`timeframe${timeframe.charAt(0).toUpperCase() + timeframe.slice(1)}`);
    if (timeframeElement) {
        timeframeElement.classList.add('selected');
    }
    
    // Switch to the selected timeframe data
    if (playbackData[timeframe]) {
        currentTimeframeData = playbackData[timeframe].combined;
        combinedData = currentTimeframeData;
        
        // Update chart with new timeframe data
        updateChartWithTimeframeData();
        
        // Update playback controls for new timeframe
        updatePlaybackControlsForTimeframe(timeframe);
        
        console.log(`Switched to ${timeframe} timeframe with ${currentTimeframeData.length} data points`);
    } else if (allTimeframeData[timeframe]) {
        // Fallback for data without playback structure
        currentTimeframeData = [...originalData, ...allTimeframeData[timeframe]];
        combinedData = currentTimeframeData;
        updateChartWithTimeframeData();
    }
}

function updatePlaybackControlsForTimeframe(timeframe) {
    if (playbackData[timeframe]) {
        const data = playbackData[timeframe];
        const maxIndex = data.combined.length - 1;
        
        // Update slider
        if (playbackSlider) {
            playbackSlider.max = maxIndex;
            playbackSlider.value = Math.min(playbackIndex, maxIndex);
        }
        
        // Update playback index if it's beyond the new timeframe's data length
        if (playbackIndex > maxIndex) {
            playbackIndex = maxIndex;
        }
        
        // Update UI
        updatePlaybackUI();
        
        // Update chart to show current playback position
        updateChartToPlaybackIndex();
        
        // Update playback speed based on timeframe
        updatePlaybackSpeedForTimeframe(timeframe);
    }
}

// Update playback speed based on timeframe
function updatePlaybackSpeedForTimeframe(timeframe) {
    switch (timeframe) {
        case '1min':
            playbackSpeed = 50; // Fast for 1-minute data
            break;
        case '5min':
            playbackSpeed = 100;
            break;
        case '15min':
            playbackSpeed = 150;
            break;
        case '1hour':
            playbackSpeed = 200;
            break;
        case 'daily':
            playbackSpeed = 500; // Slower for daily data
            break;
        case 'weekly':
            playbackSpeed = 800;
            break;
        case 'monthly':
            playbackSpeed = 1000; // Slowest for monthly data
            break;
        default:
            playbackSpeed = 500;
    }
}

function updateChartToPlaybackIndex() {
    if (!currentTimeframeData || !tvChart || !tvLineSeries) return;
    
    // Get data up to current playback index
    const dataToShow = currentTimeframeData.slice(0, playbackIndex + 1);
    
    // Check if we have OHLC data
    const hasOHLC = dataToShow.length > 0 && 
                   dataToShow[0].open !== undefined && 
                   dataToShow[0].high !== undefined && 
                   dataToShow[0].low !== undefined && 
                   dataToShow[0].close !== undefined;
    
    if (hasOHLC) {
        // Handle candlestick data
        const chartData = dataToShow
            .filter(point => 
                point && 
                point.open != null && point.open !== "" && !isNaN(Number(point.open)) &&
                point.high != null && point.high !== "" && !isNaN(Number(point.high)) &&
                point.low != null && point.low !== "" && !isNaN(Number(point.low)) &&
                point.close != null && point.close !== "" && !isNaN(Number(point.close)) &&
                point.timestamp && point.timestamp !== ""
            )
            .map(point => ({
                time: typeof point.timestamp === 'string' ? new Date(point.timestamp).getTime() / 1000 : point.timestamp / 1000,
                open: Number(point.open),
                high: Number(point.high),
                low: Number(point.low),
                close: Number(point.close)
            }));
        
        if (chartData.length > 0) {
            tvLineSeries.setData(chartData);
            
            // Update chart time scale based on timeframe
            updateChartTimeScale(selectedTimeframe, chartData);
        }
    } else {
        // Handle line chart data
        const chartData = dataToShow
            .filter(point => 
                point && 
                (point.close || point.price || point.value) && 
                point.timestamp
            )
            .map(point => {
                const timestamp = point.timestamp || point.date || new Date().getTime();
                const value = parseFloat(point.close || point.price || point.value || 0);
                
                return {
                    time: typeof timestamp === 'string' ? new Date(timestamp).getTime() / 1000 : timestamp / 1000,
                    value: value
                };
            });
        
        if (chartData.length > 0) {
            tvLineSeries.setData(chartData);
            
            // Update chart time scale based on timeframe
            updateChartTimeScale(selectedTimeframe, chartData);
        }
    }
}

// Update chart time scale based on selected timeframe
function updateChartTimeScale(timeframe, chartData) {
    if (!tvChart || !chartData.length) return;
    
    const timeScale = tvChart.timeScale();
    
    // Set appropriate time scale based on timeframe
    switch (timeframe) {
        case '1min':
            timeScale.applyOptions({
                timeVisible: true,
                secondsVisible: false,
                tickMarkFormatter: (time) => {
                    const date = new Date(time * 1000);
                    return date.toLocaleTimeString('en-US', { 
                        hour: '2-digit', 
                        minute: '2-digit',
                        hour12: false 
                    });
                }
            });
            break;
        case '5min':
        case '15min':
            timeScale.applyOptions({
                timeVisible: true,
                secondsVisible: false,
                tickMarkFormatter: (time) => {
                    const date = new Date(time * 1000);
                    return date.toLocaleTimeString('en-US', { 
                        hour: '2-digit', 
                        minute: '2-digit',
                        hour12: false 
                    });
                }
            });
            break;
        case '1hour':
            timeScale.applyOptions({
                timeVisible: true,
                secondsVisible: false,
                tickMarkFormatter: (time) => {
                    const date = new Date(time * 1000);
                    return date.toLocaleTimeString('en-US', { 
                        hour: '2-digit', 
                        minute: '2-digit',
                        hour12: false 
                    });
                }
            });
            break;
        case 'daily':
            timeScale.applyOptions({
                timeVisible: true,
                secondsVisible: false,
                tickMarkFormatter: (time) => {
                    const date = new Date(time * 1000);
                    return date.toLocaleDateString('en-US', { 
                        month: 'short', 
                        day: 'numeric' 
                    });
                }
            });
            break;
        case 'weekly':
            timeScale.applyOptions({
                timeVisible: true,
                secondsVisible: false,
                tickMarkFormatter: (time) => {
                    const date = new Date(time * 1000);
                    return date.toLocaleDateString('en-US', { 
                        month: 'short', 
                        day: 'numeric',
                        year: '2-digit'
                    });
                }
            });
            break;
        case 'monthly':
            timeScale.applyOptions({
                timeVisible: true,
                secondsVisible: false,
                tickMarkFormatter: (time) => {
                    const date = new Date(time * 1000);
                    return date.toLocaleDateString('en-US', { 
                        month: 'short', 
                        year: '2-digit'
                    });
                }
            });
            break;
    }
}



function detectTimeframeData(data, headers) {
    // Check if data has timestamp/date and OHLC columns
    const hasDate = headers.some(h => h.toLowerCase().includes('date') || h.toLowerCase().includes('timestamp'));
    const hasOHLC = headers.some(h => h.toLowerCase().includes('open')) && 
                   headers.some(h => h.toLowerCase().includes('close'));
    
    // Check if data has time-based patterns (frequent timestamps)
    if (hasDate && data.length > 10) {
        const dateColumn = headers.find(h => h.toLowerCase().includes('date') || h.toLowerCase().includes('timestamp'));
        const dates = data.map(row => new Date(row[dateColumn])).filter(d => !isNaN(d.getTime()));
        
        if (dates.length > 5) {
            // Calculate average time difference
            const timeDiffs = [];
            for (let i = 1; i < dates.length; i++) {
                timeDiffs.push(dates[i].getTime() - dates[i-1].getTime());
            }
            
            const avgDiff = timeDiffs.reduce((a, b) => a + b, 0) / timeDiffs.length;
            
            // Classify timeframe based on average time difference
            if (avgDiff <= 60000) return '1min'; // 1 minute or less
            if (avgDiff <= 300000) return '5min'; // 5 minutes
            if (avgDiff <= 900000) return '15min'; // 15 minutes
            if (avgDiff <= 3600000) return '1hour'; // 1 hour
            if (avgDiff <= 86400000) return 'daily'; // 1 day
            if (avgDiff <= 604800000) return 'weekly'; // 1 week
            return 'monthly'; // Monthly or longer
        }
    }
    
    return null;
}

function handleSymbolSearchInput(e) {
    const query = e.target.value.trim().toLowerCase();
    if (!query || allSymbols.length === 0) {
        alphaSymbolDropdown.style.display = 'none';
        fetchAlphaBtn.disabled = true;
        selectedSymbol = null;
        return;
    }
    // Filter tickers by symbol only
    filteredSymbols = allSymbols.filter(s =>
        typeof s === 'string' && s.toLowerCase().includes(query)
    ).slice(0, 50); // Limit to 50 results
    renderSymbolDropdown();
}

function renderSymbolDropdown() {
    alphaSymbolDropdown.innerHTML = '';
    if (filteredSymbols.length === 0) {
        alphaSymbolDropdown.style.display = 'none';
        fetchAlphaBtn.disabled = true;
        selectedSymbol = null;
        return;
    }
    filteredSymbols.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s;
        opt.textContent = s;
        alphaSymbolDropdown.appendChild(opt);
    });
    alphaSymbolDropdown.selectedIndex = 0;
    alphaSymbolDropdown.style.display = 'block';
    handleSymbolDropdownChange();
}

function handleSymbolDropdownChange() {
    const idx = alphaSymbolDropdown.selectedIndex;
    if (idx >= 0 && filteredSymbols[idx]) {
        selectedSymbol = filteredSymbols[idx];
        fetchAlphaBtn.disabled = false;
    } else {
        selectedSymbol = null;
        fetchAlphaBtn.disabled = true;
    }
}

async function fetchAlphaVantageData() {
    if (!selectedSymbol) {
        showAlphaVantageAlert('Please select a stock symbol.', 'error');
        return;
    }
    showAlphaVantageAlert(`Fetching data for ${selectedSymbol} from Alpha Vantage...`, 'info');
    fetchAlphaBtn.disabled = true;
    try {
        const response = await fetch('/api/fetch-alpha-vantage', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ symbol: selectedSymbol })
        });
        const data = await response.json();
        if (data.success) {
            const transformationResult = detectAndTransformData(data.data);
            if (transformationResult.success) {
                originalData = transformationResult.data;
                // Analyze structure using backend
                const analysisRes = await fetch('/api/analyze-structure', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ data: originalData })
                });
                const analysisJson = await analysisRes.json();
                dataAnalysis = analysisJson.analysis || {};
                combinedData = [...originalData];
                showAlphaVantageAlert(`Successfully fetched and transformed data for ${selectedSymbol}.`, 'success');
                displayTransformationInfo();
                displayDataAnalysis();
                displayDataPreview();
                populateChartOptions();
                createOrResetTVChart();
                generateBtn.disabled = false;
            } else {
                showAlphaVantageAlert(`Fetch successful but transformation failed: ${transformationResult.error}`, 'warning');
                originalData = data.data;
                // Analyze structure using backend
                const analysisRes = await fetch('/api/analyze-structure', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ data: originalData })
                });
                const analysisJson = await analysisRes.json();
                dataAnalysis = analysisJson.analysis || {};
                combinedData = [...originalData];
                displayDataPreview();
                populateChartOptions();
                createOrResetTVChart();
                generateBtn.disabled = false;
            }
        } else {
            showAlphaVantageAlert(data.error || 'Failed to fetch data.', 'error');
        }
    } catch (err) {
        showAlphaVantageAlert('Error fetching data from Alpha Vantage.', 'error');
    }
    fetchAlphaBtn.disabled = false;
}

function showAlphaVantageAlert(message, type) {
    if (!alphaVantageAlert) return;
    let alertClass = 'alert-info';
    if (type === 'success') alertClass = 'alert-success';
    else if (type === 'error') alertClass = 'alert-error';
    else if (type === 'warning') alertClass = 'alert-warning';
    alphaVantageAlert.innerHTML = `<div class="alert ${alertClass}">${message}</div>`;
    setTimeout(() => { alphaVantageAlert.innerHTML = ''; }, 5000);
}

async function generateNewData() {
    if (!originalData.length) {
        showAlert('Please fetch data from Yahoo Finance first.', 'error');
        return;
    }

    const numPointsToGenerate = parseInt(numPoints.value);
    if (numPointsToGenerate < 1 || numPointsToGenerate > 1000) {
        showAlert('Please enter a valid number of points (1-1000).', 'error');
        return;
    }

    loading.classList.add('show');
    loadingText.textContent = 'Generating data for all timeframes...';
    generateBtn.disabled = true;

    try {
        let response;
        
        if (selectedMethod === 'ai') {
            // AI Generation - single timeframe
            response = await fetch('/api/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    originalData: originalData,
                    numPoints: numPointsToGenerate,
                    analysis: dataAnalysis
                })
            });
        } else {
            // Built-in Statistical Generation - all timeframes
            response = await fetch('/api/generate-multi-timeframe', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    originalData: originalData,
                    numPoints: numPointsToGenerate,
                    analysis: dataAnalysis
                })
            });
        }

        const result = await response.json();

        if (result.success) {
            if (selectedMethod === 'builtin' && result.generatedData) {
                // Multi-timeframe data - store all timeframes
                allTimeframeData = result.generatedData;
                multiTimeframeData = result.generatedData;
                
                // Initialize playback data for each timeframe
                initializePlaybackData();
                
                // Set current timeframe data
                generatedData = result.generatedData[selectedTimeframe] || [];
                currentTimeframeData = generatedData;
                
                // Update timeframe selector with available timeframes
                updateTimeframeSelector(Object.keys(result.generatedData));
                
                showAlert(`Successfully generated data for ${Object.keys(result.generatedData).length} timeframes!`, 'success');
            } else {
                // Single timeframe data (AI generation)
                generatedData = result.generatedData || [];
                currentTimeframeData = generatedData;
                
                // For AI generation, create single timeframe data
                allTimeframeData = { 'daily': generatedData };
                initializePlaybackData();
                
                showAlert(`Successfully generated ${generatedData.length} new data points!`, 'success');
            }
            
            // Only use generated data for visualization (no historical data)
            combinedData = [...generatedData];
            
            // Update UI
            displayDataAnalysis();
            displayDataPreview();
            updateChart();
            updatePlaybackControlsOnDataChange();
            
        } else {
            showAlert(`Error: ${result.error}`, 'error');
        }
    } catch (error) {
        console.error('Generation error:', error);
        showAlert('Error generating data. Please try again.', 'error');
    } finally {
        loading.classList.remove('show');
        generateBtn.disabled = false;
    }
}

function initializePlaybackData() {
    // Initialize playback data for each timeframe
    playbackData = {};
    
    for (const [timeframe, data] of Object.entries(allTimeframeData)) {
        if (data && data.length > 0) {
            playbackData[timeframe] = {
                original: [...originalData],
                generated: [...data],
                combined: [...data], // Only show generated data (no historical data)
                currentIndex: 0
            };
        }
    }
    
    // Set current timeframe playback data
    if (playbackData[selectedTimeframe]) {
        currentTimeframeData = playbackData[selectedTimeframe].combined;
    }
}

function updateTimeframeSelector(availableTimeframes) {
    // Show/hide timeframe options based on available data
    const timeframeOptions = document.querySelectorAll('.timeframe-option');
    timeframeOptions.forEach(option => {
        const timeframeId = option.id.replace('timeframe', '').toLowerCase();
        if (availableTimeframes.includes(timeframeId)) {
            option.style.display = 'block';
        } else {
            option.style.display = 'none';
        }
    });
}

function updateChartWithTimeframeData() {
    if (!currentTimeframeData || !currentTimeframeData.length) return;
    
    // Recreate chart with new data
    createOrResetTVChart();
    
    // Add data to chart up to current playback index
    if (tvChart && tvLineSeries) {
        const dataToShow = currentTimeframeData.slice(0, playbackIndex + 1);
        
        // Check if we have OHLC data
        const hasOHLC = dataToShow.length > 0 && 
                       dataToShow[0].open !== undefined && 
                       dataToShow[0].high !== undefined && 
                       dataToShow[0].low !== undefined && 
                       dataToShow[0].close !== undefined;
        
        if (hasOHLC) {
            // Handle candlestick data
            const chartData = dataToShow
                .filter(point => 
                    point && 
                    point.open != null && point.open !== "" && !isNaN(Number(point.open)) &&
                    point.high != null && point.high !== "" && !isNaN(Number(point.high)) &&
                    point.low != null && point.low !== "" && !isNaN(Number(point.low)) &&
                    point.close != null && point.close !== "" && !isNaN(Number(point.close)) &&
                    point.timestamp && point.timestamp !== ""
                )
                .map(point => ({
                    time: typeof point.timestamp === 'string' ? new Date(point.timestamp).getTime() / 1000 : point.timestamp / 1000,
                    open: Number(point.open),
                    high: Number(point.high),
                    low: Number(point.low),
                    close: Number(point.close)
                }));
            
            if (chartData.length > 0) {
                tvLineSeries.setData(chartData);
                
                // Update chart time scale based on timeframe
                updateChartTimeScale(selectedTimeframe, chartData);
            }
        } else {
            // Handle line chart data
            const chartData = dataToShow
                .filter(point => 
                    point && 
                    (point.close || point.price || point.value) && 
                    point.timestamp
                )
                .map(point => {
                    const timestamp = point.timestamp || point.date || new Date().getTime();
                    const value = parseFloat(point.close || point.price || point.value || 0);
                    
                    return {
                        time: typeof timestamp === 'string' ? new Date(timestamp).getTime() / 1000 : timestamp / 1000,
                        value: value
                    };
                });
            
            if (chartData.length > 0) {
                tvLineSeries.setData(chartData);
                
                // Update chart time scale based on timeframe
                updateChartTimeScale(selectedTimeframe, chartData);
            }
        }
        
        setFullTimeline();
    }
}

function displayDataAnalysis() {
    if (!dataAnalysis || !dataAnalysis.columns) return;

    const stats = dataAnalysis;
    const totalRows = combinedData.length;
    const generatedRows = generatedData.length;

    dataStats.innerHTML = `
        <div class="stat-card">
            <h3>${totalRows}</h3>
            <p>Generated Rows</p>
        </div>
        <div class="stat-card">
            <h3>${generatedRows}</h3>
            <p>Future Data Points</p>
        </div>
        <div class="stat-card">
            <h3>${stats.columns.length}</h3>
            <p>Columns</p>
        </div>
        <div class="stat-card">
            <h3>${selectedTimeframe}</h3>
            <p>Timeframe</p>
        </div>
    `;

    dataStats.style.display = 'grid';
    // Auto-select xAxis and yAxis for OHLC data (only if elements exist)
    const columns = dataAnalysis.columns;
    if (columns.includes('open') && columns.includes('high') && columns.includes('low') && columns.includes('close')) {
        // Find the date column (first column of type 'date')
        const dateCol = columns.find(col => dataAnalysis.columnTypes[col] === 'date');
        if (dateCol && xAxis) xAxis.value = dateCol;
        if (yAxis) yAxis.value = 'close';
    }
    updatePlaybackControlsOnDataChange();
}

function displayDataPreview() {
    if (combinedData.length === 0) return;

    const columns = Object.keys(combinedData[0]);
    const previewData = combinedData.slice(0, 10);

    let tableHTML = '<h3>Generated Future Data Preview</h3>';
    tableHTML += '<table class="data-table">';
    
    // Header
    tableHTML += '<thead><tr>';
    columns.forEach(column => {
        tableHTML += `<th>${column}</th>`;
    });
    tableHTML += '</tr></thead>';
    
    // Body
    tableHTML += '<tbody>';
    previewData.forEach(row => {
        tableHTML += '<tr>';
        columns.forEach(column => {
            const value = row[column] || '';
            tableHTML += `<td>${value}</td>`;
        });
        tableHTML += '</tr>';
    });
    tableHTML += '</tbody></table>';

    dataTable.innerHTML = tableHTML;
    dataPreview.style.display = 'block';
}

function populateChartOptions() {
    if (!dataAnalysis || !dataAnalysis.columns) return;

    const columns = dataAnalysis.columns;
    
    // Check if chart option elements exist
    if (xAxis && yAxis) {
        // Clear existing options
        xAxis.innerHTML = '';
        yAxis.innerHTML = '';
        
        // Add options
        columns.forEach(column => {
            const xOption = document.createElement('option');
            xOption.value = column;
            xOption.textContent = column;
            xAxis.appendChild(xOption);
            
            const yOption = document.createElement('option');
            yOption.value = column;
            yOption.textContent = column;
            yAxis.appendChild(yOption);
        });
        
        // Set default selections
        if (columns.length > 0) {
            xAxis.value = columns[0];
            yAxis.value = columns.length > 1 ? columns[1] : columns[0];
        }
        
        if (updateChartBtn) {
            updateChartBtn.disabled = false;
        }
    }
}

function getXType() {
    if (!dataAnalysis) return 'auto';
    const xColumn = xAxis && xAxis.value ? xAxis.value : 'timestamp';
    const xType = dataAnalysis.columnTypes ? dataAnalysis.columnTypes[xColumn] : null;
    if (xType === 'date') return 'date';
    if (xType === 'numeric') return 'linear';
    return 'category';
}

function parseXValue(value) {
    const xType = getXType();
    if (value === null || value === undefined || value === '') return null;
    if (xType === 'date') {
        // Try to parse as date and return ISO string
        const date = new Date(value);
        if (!isNaN(date.getTime())) return date.toISOString();
        return value;
    }
    if (xType === 'linear') {
        const num = parseFloat(value);
        if (!isNaN(num)) return num;
    }
    return value;
}

function createOrResetTVChart() {
    const chartContainer = document.getElementById('tvChart');
    chartContainer.innerHTML = '';
    
    // Get user-selected interval
    let userInterval = xTickInterval && xTickInterval.value !== '' ? parseFloat(xTickInterval.value) : null;
    
    // Configure timeScale based on interval
    let timeScaleConfig = {
        timeVisible: true,
        secondsVisible: true,
        borderColor: '#23242a',
    };
    
    // Apply interval settings if user selected one
    if (userInterval && userInterval > 0) {
        // Convert milliseconds to appropriate time unit
        if (userInterval >= 31536000000) { // 1 year
            timeScaleConfig.timeUnit = 'year';
        } else if (userInterval >= 2592000000) { // 1 month
            timeScaleConfig.timeUnit = 'month';
        } else if (userInterval >= 604800000) { // 1 week
            timeScaleConfig.timeUnit = 'week';
        } else if (userInterval >= 86400000) { // 1 day
            timeScaleConfig.timeUnit = 'day';
        } else if (userInterval >= 3600000) { // 1 hour
            timeScaleConfig.timeUnit = 'hour';
        } else if (userInterval >= 60000) { // 1 minute
            timeScaleConfig.timeUnit = 'minute';
        } else { // 1 second
            timeScaleConfig.timeUnit = 'second';
        }
    }
    
    tvChart = window.LightweightCharts.createChart(chartContainer, {
        width: chartContainer.offsetWidth,
        height: chartContainer.offsetHeight,
        layout: {
            background: { type: 'solid', color: '#15171c' },
            textColor: '#f2f2f2',
        },
        grid: {
            vertLines: { color: '#23242a' },
            horzLines: { color: '#23242a' },
        },
        timeScale: timeScaleConfig,
        rightPriceScale: {
            borderColor: '#23242a',
        },
        crosshair: {
            mode: 0,
        },
    });
    
    // Detect if we have OHLC columns
    const columns = combinedData.length > 0 ? Object.keys(combinedData[0]) : [];
    const hasOHLC = columns.includes('open') && columns.includes('high') && columns.includes('low') && columns.includes('close');

    // --- PATCH: Validate and map data for TradingView ---
    let chartData = [];
    if (hasOHLC) {
        chartData = combinedData
            .filter(row =>
                row &&
                row["open"] != null && row["open"] !== "" && !isNaN(Number(row["open"])) &&
                row["high"] != null && row["high"] !== "" && !isNaN(Number(row["high"])) &&
                row["low"] != null && row["low"] !== "" && !isNaN(Number(row["low"])) &&
                row["close"] != null && row["close"] !== "" && !isNaN(Number(row["close"])) &&
                row["timestamp"] && row["timestamp"] !== ""
            )
            .map(row => ({
                time: row["timestamp"],
                open: Number(row["open"]),
                high: Number(row["high"]),
                low: Number(row["low"]),
                close: Number(row["close"])
            }));
        // Log chartData for debugging
        console.log("Chart data being passed to TradingView:", chartData);
    }
    // --- END PATCH ---

    if (hasOHLC) {
        tvLineSeries = tvChart.addSeries(window.LightweightCharts.CandlestickSeries, {});
        // Set data only if valid
        if (chartData.length > 0) {
            try {
                tvLineSeries.setData(chartData);
                console.log(`✅ Candlestick chart created with ${chartData.length} data points`);
            } catch (error) {
                console.error('Error setting candlestick data:', error);
                console.log('Chart data that caused error:', chartData);
            }
        } else {
            console.warn('⚠️ No valid candlestick data available');
        }
    } else {
        tvLineSeries = tvChart.addSeries(window.LightweightCharts.LineSeries, {
            color: '#58a6ff',
            lineWidth: 2,
        });
        
        // For line charts, create simple time-value data
        const lineChartData = combinedData
            .filter(row => 
                row && 
                (row.close || row.price || row.value) && 
                row.timestamp
            )
            .map((row, index) => {
                const timestamp = row.timestamp || row.date || new Date().getTime() + index * 60000;
                const value = parseFloat(row.close || row.price || row.value || 0);
                
                return {
                    time: typeof timestamp === 'string' ? new Date(timestamp).getTime() / 1000 : timestamp / 1000,
                    value: value
                };
            });
        
        if (lineChartData.length > 0) {
            try {
                tvLineSeries.setData(lineChartData);
                console.log(`✅ Line chart created with ${lineChartData.length} data points`);
            } catch (error) {
                console.error('Error setting line data:', error);
                console.log('Chart data that caused error:', lineChartData);
            }
        } else {
            console.warn('⚠️ No valid line chart data available');
        }
    }
    
    // Set the full timeline immediately for TradingView-like experience
    if (combinedData.length > 0 && tvChart) {
        setFullTimeline();
    }
}

// New function to set the full timeline immediately
function setFullTimeline() {
    if (!combinedData.length || !tvChart) return;
    
    // If xAxis doesn't exist, use timestamp as default
    const xColumn = xAxis && xAxis.value ? xAxis.value : 'timestamp';
    const xType = getXType();
    
    console.log('Setting full timeline with:', {
        dataLength: combinedData.length,
        xColumn: xColumn,
        xType: xType
    });
    
    // Create timeline data with all x-values but no y-values initially
    let timelineData = [];
    for (let i = 0; i < combinedData.length; i++) {
        const row = combinedData[i];
        const xValue = parseXValue(row[xColumn]);
        
        // Skip invalid x values
        if (xValue === null || xValue === undefined || xValue === '') {
            console.log(`Skipping invalid x value at index ${i}:`, xValue);
            continue;
        }
        
        let timeVal = xValue;
        
        if (xType === 'date') {
            if (typeof timeVal === 'string' && timeVal.length >= 10) {
                // For TradingView, try using the original date string format
                // If that doesn't work, we'll convert to timestamp
                const date = new Date(timeVal);
                if (!isNaN(date.getTime())) {
                    // Try using the original string first, fallback to timestamp
                    timeVal = timeVal.slice(0, 10); // Use YYYY-MM-DD format
                } else {
                    console.log(`Invalid date string at index ${i}:`, timeVal);
                    continue;
                }
            } else if (typeof timeVal === 'number') {
                // If it's already a timestamp, convert to seconds if it's in milliseconds
                if (timeVal > 1000000000000) { // If it's in milliseconds
                    timeVal = Math.floor(timeVal / 1000);
                }
            }
        }
        
        // Validate the processed time value
        if (timeVal === null || timeVal === undefined || timeVal === '') {
            console.log(`Skipping invalid processed time value at index ${i}:`, timeVal);
            continue;
        }
        
        timelineData.push({ time: timeVal, originalIndex: i });
    }
    
    // Check if we have valid timeline data
    if (timelineData.length === 0) {
        console.warn('No valid timeline data found');
        return;
    }
    
    console.log('Timeline data before sorting:', timelineData.slice(0, 5));
    
    // Sort timeline data
    if (xType === 'linear') {
        timelineData.sort((a, b) => a.time - b.time);
    } else if (xType === 'date') {
        timelineData.sort((a, b) => new Date(a.time) - new Date(b.time));
    }
    
    console.log('Timeline data after sorting:', timelineData.slice(0, 5));
    
    // Validate the first and last time values
    const firstTime = timelineData[0].time;
    const lastTime = timelineData[timelineData.length - 1].time;
    
    console.log('Time range:', { firstTime, lastTime, firstTimeType: typeof firstTime, lastTimeType: typeof lastTime });
    
    if (firstTime === null || lastTime === null || firstTime === undefined || lastTime === undefined) {
        console.warn('Invalid time range values');
        return;
    }
    
    // Additional validation for date types
    if (xType === 'date') {
        const firstDate = new Date(firstTime);
        const lastDate = new Date(lastTime);
        
        if (isNaN(firstDate.getTime()) || isNaN(lastDate.getTime())) {
            console.warn('Invalid date values:', { firstTime, lastTime });
            return;
        }
        
        console.log('Valid date range:', { firstDate, lastDate });
    }
    
    try {
        // Just fit content to show the full timeline - this should work better
        tvChart.timeScale().fitContent();
        console.log('Timeline set successfully');
    } catch (error) {
        console.warn('Error fitting content:', error);
    }
}

function updateChart() {
    if (!combinedData.length) return;
    
    // If xAxis/yAxis don't exist, use default columns for OHLC data
    let xColumn, yColumn;
    if (xAxis && yAxis && xAxis.value && yAxis.value) {
        xColumn = xAxis.value;
        yColumn = yAxis.value;
    } else {
        // Default to timestamp and close for OHLC data
        const columns = Object.keys(combinedData[0]);
        if (columns.includes('timestamp') && columns.includes('close')) {
            xColumn = 'timestamp';
            yColumn = 'close';
        } else if (columns.length >= 2) {
            xColumn = columns[0];
            yColumn = columns[1];
        } else {
            return; // Not enough data to chart
        }
    }
    const xType = getXType();
    
    // Detect if we have OHLC columns
    const columns = combinedData.length > 0 ? Object.keys(combinedData[0]) : [];
    const hasOHLC = columns.includes('open') && columns.includes('high') && columns.includes('low') && columns.includes('close');
    
    if (hasOHLC) {
        // Candlestick data - only add data for points within current playback index
        let tvData = [];
        for (let i = 0; i <= playbackIndex && i < combinedData.length; i++) {
            const row = combinedData[i];
            const xValue = parseXValue(row[xColumn]);
            let timeVal = xValue;
            
            if (xType === 'date') {
                if (typeof timeVal === 'string' && timeVal.length >= 10) {
                    // For TradingView, try using the original date string format
                    // If that doesn't work, we'll convert to timestamp
                    const date = new Date(timeVal);
                    if (!isNaN(date.getTime())) {
                        // Try using the original string first, fallback to timestamp
                        timeVal = timeVal.slice(0, 10); // Use YYYY-MM-DD format
                    } else {
                        continue;
                    }
                } else if (typeof timeVal === 'number') {
                    // If it's already a timestamp, convert to seconds if it's in milliseconds
                    if (timeVal > 1000000000000) { // If it's in milliseconds
                        timeVal = Math.floor(timeVal / 1000);
                    }
                }
            }
            
            const open = parseFloat(row.open);
            const high = parseFloat(row.high);
            const low = parseFloat(row.low);
            const close = parseFloat(row.close);
            
            if (
                open == null || isNaN(open) ||
                high == null || isNaN(high) ||
                low == null || isNaN(low) ||
                close == null || isNaN(close)
            ) {
                continue;
            }
            
            tvData.push({
                time: timeVal,
                open,
                high,
                low,
                close
            });
        }
        
        // Only recreate chart if it doesn't exist, otherwise just update data
        if (!tvChart) {
            createOrResetTVChart();
        }
        tvLineSeries.setData(tvData);
        
    } else {
        // Line data - only add data for points within current playback index
        let tvData = [];
        for (let i = 0; i <= playbackIndex && i < combinedData.length; i++) {
            const row = combinedData[i];
            const xValue = parseXValue(row[xColumn]);
            const yValue = parseFloat(row[yColumn]);
            let timeVal = xValue;
            
            if (xType === 'date') {
                if (typeof timeVal === 'string' && timeVal.length >= 10) {
                    // For TradingView, try using the original date string format
                    // If that doesn't work, we'll convert to timestamp
                    const date = new Date(timeVal);
                    if (!isNaN(date.getTime())) {
                        // Try using the original string first, fallback to timestamp
                        timeVal = timeVal.slice(0, 10); // Use YYYY-MM-DD format
                    } else {
                        continue;
                    }
                } else if (typeof timeVal === 'number') {
                    // If it's already a timestamp, convert to seconds if it's in milliseconds
                    if (timeVal > 1000000000000) { // If it's in milliseconds
                        timeVal = Math.floor(timeVal / 1000);
                    }
                }
            }
            
            if (yValue === null || isNaN(yValue)) continue;
            
            tvData.push({
                time: timeVal,
                value: yValue
            });
        }
        
        // Only recreate chart if it doesn't exist, otherwise just update data
        if (!tvChart) {
            createOrResetTVChart();
        }
        tvLineSeries.setData(tvData);
    }
}

function appendNewPointsToChart(newPoints) {
    // For TradingView, just call updateChart (since playbackIndex logic is handled there)
    updateChart();
}

function parseValue(value) {
    if (value === null || value === undefined || value === '') {
        return null;
    }
    
    // Try to parse as number
    const num = parseFloat(value);
    if (!isNaN(num)) {
        return num;
    }
    
    // Try to parse as date
    const date = new Date(value);
    if (!isNaN(date.getTime())) {
        return date.getTime();
    }
    
    // Return as string (for categorical data)
    return value;
}

function showAlert(message, type) {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type}`;
    alertDiv.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
        ${message}
    `;
    
    document.body.appendChild(alertDiv);
    
    setTimeout(() => {
        alertDiv.remove();
    }, 5000);
}

function resetPlayback() {
    playbackIndex = 0;
    isPlaying = false;
    updatePlaybackUI();
    updateChart();
}

function startPlayback() {
    if (!currentTimeframeData || currentTimeframeData.length === 0) return;
    
    isPlaying = true;
    playPauseBtn.textContent = '⏸ Pause';
    
    playbackTimer = setInterval(() => {
        if (playbackIndex < currentTimeframeData.length - 1) {
            playbackIndex++;
            updateChartToPlaybackIndex();
            updatePlaybackUI();
        } else {
            stopPlayback();
        }
    }, playbackSpeed);
}

function stopPlayback() {
    isPlaying = false;
    playPauseBtn.textContent = '▶ Play';
    
    if (playbackTimer) {
        clearInterval(playbackTimer);
        playbackTimer = null;
    }
}

function togglePlayback() {
    if (isPlaying) {
        stopPlayback();
    } else {
        startPlayback();
    }
}

function handleSliderChange(e) {
    playbackIndex = parseInt(e.target.value);
    updateChartToPlaybackIndex();
    updatePlaybackUI();
}

function updatePlaybackUI() {
    if (playbackSlider) {
        playbackSlider.value = playbackIndex;
    }
    
    if (playbackIndexLabel) {
        const currentData = currentTimeframeData[playbackIndex];
        const timestamp = currentData ? (currentData.timestamp || currentData.date || `Point ${playbackIndex + 1}`) : 'N/A';
        playbackIndexLabel.textContent = `${playbackIndex + 1}/${currentTimeframeData.length}`;
    }
}

function updatePlaybackControlsOnDataChange() {
    if (!currentTimeframeData || currentTimeframeData.length === 0) return;
    
    const maxIndex = currentTimeframeData.length - 1;
    
    if (playbackSlider) {
        playbackSlider.max = maxIndex;
        playbackSlider.value = Math.min(playbackIndex, maxIndex);
    }
    
    // Reset playback if current index is beyond new data length
    if (playbackIndex > maxIndex) {
        playbackIndex = maxIndex;
    }
    
    updatePlaybackUI();
} 

// Data transformation functions
function detectAndTransformData(rawData) {
    console.log('Detecting and transforming data...');
    
    if (!rawData || rawData.length === 0) {
        console.warn('No data to transform');
        return { success: false, error: 'No data provided' };
    }
    
    const firstRow = rawData[0];
    const columns = Object.keys(firstRow);
    
    console.log('Raw data columns:', columns);
    console.log('Sample row:', firstRow);
    
    // Detect data type and transform accordingly
    const transformationResult = detectDataType(rawData, columns);
    
    if (transformationResult.success) {
        transformedData = transformationResult.transformedData;
        dataTransformationInfo = transformationResult.info;
        
        console.log('Data transformation successful:', dataTransformationInfo);
        console.log('Transformed data sample:', transformedData.slice(0, 3));
        
        return { success: true, data: transformedData, info: dataTransformationInfo };
    } else {
        console.error('Data transformation failed:', transformationResult.error);
        return transformationResult;
    }
}

function detectDataType(data, columns) {
    // Check for OHLC (candlestick) data
    if (isOHLCData(columns)) {
        return transformOHLCData(data, columns);
    }
    
    // Check for time series data
    if (isTimeSeriesData(columns)) {
        return transformTimeSeriesData(data, columns);
    }
    
    // Check for simple numeric data
    if (isNumericData(columns)) {
        return transformNumericData(data, columns);
    }
    
    // Check for categorical data
    if (isCategoricalData(columns)) {
        return transformCategoricalData(data, columns);
    }
    
    // Default: try to transform as generic data
    return transformGenericData(data, columns);
}

function isOHLCData(columns) {
    const ohlcKeywords = ['open', 'high', 'low', 'close', 'volume'];
    const hasOHLC = ohlcKeywords.every(keyword => 
        columns.some(col => col.toLowerCase().includes(keyword))
    );
    
    // Also check for common variations
    const variations = [
        ['open', 'high', 'low', 'close'],
        ['o', 'h', 'l', 'c'],
        ['opening', 'highest', 'lowest', 'closing']
    ];
    
    for (const variation of variations) {
        if (variation.every(keyword => 
            columns.some(col => col.toLowerCase().includes(keyword))
        )) {
            return true;
        }
    }
    
    return hasOHLC;
}

function isTimeSeriesData(columns) {
    const timeKeywords = ['date', 'time', 'timestamp', 'datetime'];
    const hasTimeColumn = timeKeywords.some(keyword => 
        columns.some(col => col.toLowerCase().includes(keyword))
    );
    
    return hasTimeColumn;
}

function isNumericData(columns) {
    // Check if most columns are numeric
    const sampleRow = Object.values(combinedData[0] || {});
    const numericCount = sampleRow.filter(val => !isNaN(parseFloat(val))).length;
    
    return numericCount >= columns.length * 0.7; // 70% numeric
}

function isCategoricalData(columns) {
    // Check if data contains mostly text/categorical values
    const sampleRow = Object.values(combinedData[0] || {});
    const textCount = sampleRow.filter(val => 
        typeof val === 'string' && isNaN(parseFloat(val))
    ).length;
    
    return textCount >= columns.length * 0.5; // 50% text
}

function transformOHLCData(data, columns) {
    console.log('Transforming OHLC data...');
    
    const columnMap = mapOHLCColumns(columns);
    const transformedData = [];
    
    for (let i = 0; i < data.length; i++) {
        const row = data[i];
        const transformedRow = {};
        
        // Map OHLC columns
        if (columnMap.open) transformedRow.open = parseFloat(row[columnMap.open]) || 0;
        if (columnMap.high) transformedRow.high = parseFloat(row[columnMap.high]) || 0;
        if (columnMap.low) transformedRow.low = parseFloat(row[columnMap.low]) || 0;
        if (columnMap.close) transformedRow.close = parseFloat(row[columnMap.close]) || 0;
        if (columnMap.volume) transformedRow.volume = parseFloat(row[columnMap.volume]) || 0;
        
        // Handle date/time column
        if (columnMap.date) {
            transformedRow.date = normalizeDate(row[columnMap.date]);
        } else {
            // Generate sequential dates if no date column
            transformedRow.date = generateSequentialDate(i);
        }
        
        transformedData.push(transformedRow);
    }
    
    return {
        success: true,
        transformedData: transformedData,
        info: {
            type: 'OHLC',
            originalColumns: columns,
            mappedColumns: columnMap,
            description: 'Candlestick/OHLC data detected and transformed'
        }
    };
}

function transformTimeSeriesData(data, columns) {
    console.log('Transforming time series data...');
    
    const dateColumn = findDateColumn(columns);
    const transformedData = [];
    
    for (let i = 0; i < data.length; i++) {
        const row = data[i];
        const transformedRow = {};
        
        // Normalize date
        if (dateColumn) {
            transformedRow.date = normalizeDate(row[dateColumn]);
        } else {
            transformedRow.date = generateSequentialDate(i);
        }
        
        // Add all other columns as numeric values
        columns.forEach(col => {
            if (col !== dateColumn) {
                const value = parseFloat(row[col]);
                if (!isNaN(value)) {
                    transformedRow[col] = value;
                }
            }
        });
        
        transformedData.push(transformedRow);
    }
    
    return {
        success: true,
        transformedData: transformedData,
        info: {
            type: 'TimeSeries',
            originalColumns: columns,
            dateColumn: dateColumn,
            description: 'Time series data detected and transformed'
        }
    };
}

function transformNumericData(data, columns) {
    console.log('Transforming numeric data...');
    
    const transformedData = [];
    
    for (let i = 0; i < data.length; i++) {
        const row = data[i];
        const transformedRow = {};
        
        // Add index as x-axis
        transformedRow.index = i;
        
        // Convert all columns to numeric
        columns.forEach(col => {
            const value = parseFloat(row[col]);
            if (!isNaN(value)) {
                transformedRow[col] = value;
            }
        });
        
        transformedData.push(transformedRow);
    }
    
    return {
        success: true,
        transformedData: transformedData,
        info: {
            type: 'Numeric',
            originalColumns: columns,
            description: 'Numeric data detected and transformed with sequential indexing'
        }
    };
}

function transformCategoricalData(data, columns) {
    console.log('Transforming categorical data...');
    
    const transformedData = [];
    
    for (let i = 0; i < data.length; i++) {
        const row = data[i];
        const transformedRow = {};
        
        // Add index as x-axis
        transformedRow.index = i;
        
        // Keep original values but try to convert numeric ones
        columns.forEach(col => {
            const value = row[col];
            const numericValue = parseFloat(value);
            
            if (!isNaN(numericValue)) {
                transformedRow[col] = numericValue;
            } else {
                transformedRow[col] = value;
            }
        });
        
        transformedData.push(transformedRow);
    }
    
    return {
        success: true,
        transformedData: transformedData,
        info: {
            type: 'Categorical',
            originalColumns: columns,
            description: 'Categorical data detected and transformed'
        }
    };
}

function transformGenericData(data, columns) {
    console.log('Transforming generic data...');
    
    const transformedData = [];
    
    for (let i = 0; i < data.length; i++) {
        const row = data[i];
        const transformedRow = {};
        
        // Add index as x-axis
        transformedRow.index = i;
        
        // Try to convert all values appropriately
        columns.forEach(col => {
            const value = row[col];
            
            // Try numeric first
            const numericValue = parseFloat(value);
            if (!isNaN(numericValue)) {
                transformedRow[col] = numericValue;
            } else {
                // Keep as string
                transformedRow[col] = value;
            }
        });
        
        transformedData.push(transformedRow);
    }
    
    return {
        success: true,
        transformedData: transformedData,
        info: {
            type: 'Generic',
            originalColumns: columns,
            description: 'Generic data detected and transformed'
        }
    };
}

function mapOHLCColumns(columns) {
    const columnMap = {};
    
    columns.forEach(col => {
        const lowerCol = col.toLowerCase();
        
        if (lowerCol.includes('open') || lowerCol === 'o') {
            columnMap.open = col;
        } else if (lowerCol.includes('high') || lowerCol === 'h') {
            columnMap.high = col;
        } else if (lowerCol.includes('low') || lowerCol === 'l') {
            columnMap.low = col;
        } else if (lowerCol.includes('close') || lowerCol === 'c') {
            columnMap.close = col;
        } else if (lowerCol.includes('volume') || lowerCol === 'vol') {
            columnMap.volume = col;
        } else if (lowerCol.includes('date') || lowerCol.includes('time')) {
            columnMap.date = col;
        }
    });
    
    return columnMap;
}

function findDateColumn(columns) {
    const dateKeywords = ['date', 'time', 'timestamp', 'datetime'];
    
    for (const keyword of dateKeywords) {
        const found = columns.find(col => col.toLowerCase().includes(keyword));
        if (found) return found;
    }
    
    return null;
}

function normalizeDate(dateValue) {
    if (!dateValue) return null;
    
    // Try to parse various date formats
    const date = new Date(dateValue);
    
    if (!isNaN(date.getTime())) {
        // Return in YYYY-MM-DD format for TradingView
        return date.toISOString().slice(0, 10);
    }
    
    // If parsing fails, return original value
    return dateValue;
}

function generateSequentialDate(index) {
    // Generate sequential dates starting from today
    const baseDate = new Date();
    baseDate.setDate(baseDate.getDate() + index);
    return baseDate.toISOString().slice(0, 10);
}

function displayTransformationInfo() {
    if (!dataTransformationInfo.type) return;
    
    const transformationSection = document.getElementById('transformationSection');
    const transformationInfo = document.getElementById('transformationInfo');
    const transformationStatus = document.getElementById('transformationStatus');
    
    if (!transformationSection || !transformationInfo || !transformationStatus) return;
    
    // Show the transformation section
    transformationSection.style.display = 'block';
    
    // Update transformation info
    transformationInfo.innerHTML = `
        <h4><i class="fas fa-magic"></i> Data Transformation Applied</h4>
        <p><strong>Type:</strong> ${dataTransformationInfo.type}</p>
        <p><strong>Description:</strong> ${dataTransformationInfo.description}</p>
        ${dataTransformationInfo.originalColumns ? 
            `<p><strong>Original Columns:</strong> ${dataTransformationInfo.originalColumns.join(', ')}</p>` : ''
        }
        ${dataTransformationInfo.mappedColumns ? 
            `<p><strong>Mapped Columns:</strong> ${JSON.stringify(dataTransformationInfo.mappedColumns)}</p>` : ''
        }
    `;
    
    // Update transformation status
    transformationStatus.innerHTML = `
        <div style="color: #28a745;">✓ Transformation successful</div>
        <div>Data type: ${dataTransformationInfo.type}</div>
        <div>Rows processed: ${transformedData.length}</div>
        <div>Original columns: ${dataTransformationInfo.originalColumns ? dataTransformationInfo.originalColumns.length : 0}</div>
        ${dataTransformationInfo.mappedColumns ? 
            `<div>Mapped columns: ${Object.keys(dataTransformationInfo.mappedColumns).length}</div>` : ''
        }
    `;
} 

function showYFinanceAlert(message, type) {
    if (!yfinanceAlert) return;
    let alertClass = 'alert-info';
    if (type === 'success') alertClass = 'alert-success';
    else if (type === 'error') alertClass = 'alert-error';
    else if (type === 'warning') alertClass = 'alert-warning';
    yfinanceAlert.innerHTML = `<div class="alert ${alertClass}">${message}</div>`;
    setTimeout(() => { yfinanceAlert.innerHTML = ''; }, 5000);
}

async function fetchYFinanceData() {
    const symbol = yfinanceSymbol.value.trim().toUpperCase();
    if (!symbol) {
        showYFinanceAlert('Please enter a stock symbol.', 'error');
        return;
    }
    showYFinanceAlert(`Fetching data for ${symbol} from Yahoo Finance...`, 'info');
    fetchYFinanceBtn.disabled = true;
    try {
        const response = await fetch('/api/fetch-yfinance', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ symbol })
        });
        const data = await response.json();
        console.log('Yahoo Finance response:', data); // Debug log
        
        if (data.success && data.data && Array.isArray(data.data)) {
            // Use the data directly without transformation for now
            originalData = data.data;
            
            // Analyze structure using backend
            const analysisRes = await fetch('/api/analyze-structure', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ data: originalData })
            });
            const analysisJson = await analysisRes.json();
            dataAnalysis = analysisJson.analysis || {};
            combinedData = [...originalData];
            
            showYFinanceAlert(`Successfully fetched ${originalData.length} data points for ${symbol}.`, 'success');
            displayDataAnalysis();
            displayDataPreview();
            if (typeof populateChartOptions === 'function') {
                populateChartOptions();
            }
            createOrResetTVChart();
            generateBtn.disabled = false;
        } else {
            showYFinanceAlert(data.error || 'Failed to fetch data or invalid data format.', 'error');
            console.error('Yahoo Finance error:', data);
        }
    } catch (err) {
        console.error('Yahoo Finance fetch error:', err);
        showYFinanceAlert('Error fetching data from Yahoo Finance: ' + err.message, 'error');
    }
    fetchYFinanceBtn.disabled = false;
} 