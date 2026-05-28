// UI Elements
const modelSelect = document.getElementById('model-select');
const trackerSelect = document.getElementById('tracker-select');
const confSlider = document.getElementById('conf-slider');
const confVal = document.getElementById('conf-val');
const uploadZone = document.getElementById('upload-zone');
const videoFileInput = document.getElementById('video-file-input');
const fileInfo = document.getElementById('file-info');
const fileNameLabel = document.getElementById('file-name-label');
const clearFileBtn = document.getElementById('clear-file-btn');
const startBtn = document.getElementById('start-btn');
const stopBtn = document.getElementById('stop-btn');
const videoPlayer = document.getElementById('video-player');
const placeholderText = document.getElementById('placeholder-text');
const streamStatus = document.getElementById('stream-status');

// Stat Labels
const statTracks = document.getElementById('stat-tracks');
const statFps = document.getElementById('stat-fps');
const statLatency = document.getElementById('stat-latency');

// State
let wsConnection = null;
let currentVideoFile = null;
let isStreaming = false;

// Chart Instances
let classChart = null;
let timelineChart = null;

// Initialize Charts on Load
document.addEventListener('DOMContentLoaded', () => {
    initCharts();
    setupEventListeners();
});

// Update Slider value text
confSlider.addEventListener('input', (e) => {
    confVal.textContent = e.target.value;
    if (isStreaming) {
        debouncedSettingsUpdate();
    }
});

// Handle settings changes on the fly
modelSelect.addEventListener('change', () => {
    if (isStreaming) sendSettingsUpdate();
});
trackerSelect.addEventListener('change', () => {
    if (isStreaming) sendSettingsUpdate();
});

// Debounce settings updates
let settingsTimeout = null;
function debouncedSettingsUpdate() {
    clearTimeout(settingsTimeout);
    settingsTimeout = setTimeout(sendSettingsUpdate, 300);
}

async function sendSettingsUpdate() {
    try {
        const response = await fetch('/update_settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model_path: modelSelect.value,
                tracker_type: trackerSelect.value,
                conf_threshold: parseFloat(confSlider.value)
            })
        });
        if (!response.ok) {
            console.error('Failed to update tracker settings on-the-fly');
        }
    } catch (err) {
        console.error('Error sending settings update:', err);
    }
}

function initCharts() {
    // 1. Class Distribution Bar Chart (Horizontal)
    const classCtx = document.getElementById('classChart').getContext('2d');
    
    // Create horizontal gradient for the bars
    const barGradient = classCtx.createLinearGradient(0, 0, 300, 0);
    barGradient.addColorStop(0, 'rgba(139, 92, 246, 0.15)'); // Electric Purple fading in
    barGradient.addColorStop(0.5, 'rgba(14, 165, 233, 0.6)'); // Cyber Cyan middle
    barGradient.addColorStop(1, 'rgba(16, 185, 129, 0.85)');   // Cyber Green tip

    classChart = new Chart(classCtx, {
        type: 'bar',
        data: {
            labels: [],
            datasets: [{
                label: 'Object Count',
                data: [],
                backgroundColor: barGradient,
                borderColor: '#10b981',
                borderWidth: 1.5,
                borderRadius: 5,
                borderSkipped: false
            }]
        },
        options: {
            indexAxis: 'y', // Convert to horizontal bar chart for better readability
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    grid: { color: 'rgba(255, 255, 255, 0.03)' },
                    ticks: { color: '#7982a9', stepSize: 1 }
                },
                y: {
                    grid: { display: false },
                    ticks: { color: '#7982a9' }
                }
            }
        }
    });

    // 2. Timeline Line Chart (Area Fills)
    const timelineCtx = document.getElementById('timelineChart').getContext('2d');
    
    // Create glowing area gradients
    const gradTracks = timelineCtx.createLinearGradient(0, 0, 0, 240);
    gradTracks.addColorStop(0, 'rgba(16, 185, 129, 0.25)'); // Cyber Green top
    gradTracks.addColorStop(1, 'rgba(16, 185, 129, 0.0)');  // Fade out

    const gradFps = timelineCtx.createLinearGradient(0, 0, 0, 240);
    gradFps.addColorStop(0, 'rgba(14, 165, 233, 0.2)');   // Cyber Cyan top
    gradFps.addColorStop(1, 'rgba(14, 165, 233, 0.0)');    // Fade out

    timelineChart = new Chart(timelineCtx, {
        type: 'line',
        data: {
            labels: [], // Frame indexes
            datasets: [
                {
                    label: 'Active Tracks',
                    data: [],
                    borderColor: '#10b981',
                    backgroundColor: gradTracks,
                    fill: true,
                    tension: 0.4,
                    borderWidth: 2.5,
                    pointBackgroundColor: '#10b981',
                    pointBorderColor: 'transparent',
                    pointHoverRadius: 6
                },
                {
                    label: 'Processing FPS',
                    data: [],
                    borderColor: '#0ea5e9',
                    backgroundColor: gradFps,
                    fill: true,
                    tension: 0.4,
                    borderWidth: 2,
                    pointBackgroundColor: '#0ea5e9',
                    pointBorderColor: 'transparent',
                    pointHoverRadius: 5
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(255, 255, 255, 0.03)' },
                    ticks: { color: '#7982a9' }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#7982a9', maxTicksLimit: 12 }
                }
            },
            plugins: {
                legend: {
                    labels: { color: '#7982a9', font: { family: 'Plus Jakarta Sans', weight: 600 } }
                }
            }
        }
    });
}

function setupEventListeners() {
    // Click upload zone trigger
    uploadZone.addEventListener('click', () => videoFileInput.click());
    
    // File input selection
    videoFileInput.addEventListener('change', handleFileSelect);
    
    // Drag and Drop
    uploadZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadZone.classList.add('dragover');
    });
    
    uploadZone.addEventListener('dragleave', () => {
        uploadZone.classList.remove('dragover');
    });
    
    uploadZone.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadZone.classList.remove('dragover');
        if (e.dataTransfer.files.length > 0) {
            videoFileInput.files = e.dataTransfer.files;
            handleFileSelect();
        }
    });
    
    // Clear file selection
    clearFileBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        videoFileInput.value = '';
        currentVideoFile = null;
        fileInfo.classList.add('hidden');
        uploadZone.classList.remove('hidden');
    });
    
    // Start / Stop buttons
    startBtn.addEventListener('click', startTracking);
    stopBtn.addEventListener('click', stopTracking);
}

async function handleFileSelect() {
    const file = videoFileInput.files[0];
    if (!file) return;
    
    // Prepare form data
    const formData = new FormData();
    formData.append("file", file);
    
    fileNameLabel.textContent = "Uploading...";
    uploadZone.classList.add('hidden');
    fileInfo.classList.remove('hidden');
    
    try {
        const response = await fetch('/upload', {
            method: 'POST',
            body: formData
        });
        const data = await response.json();
        
        if (response.ok) {
            currentVideoFile = data.filename;
            fileNameLabel.textContent = file.name;
        } else {
            alert("File upload failed: " + data.detail);
            resetUploadUI();
        }
    } catch (err) {
        console.error("Error uploading file:", err);
        alert("Error uploading file.");
        resetUploadUI();
    }
}

function resetUploadUI() {
    videoFileInput.value = '';
    currentVideoFile = null;
    fileInfo.classList.add('hidden');
    uploadZone.classList.remove('hidden');
}

function startTracking() {
    if (isStreaming) return;
    
    // Construct video feed URL query parameters
    const model = modelSelect.value;
    const tracker = trackerSelect.value;
    const conf = confSlider.value;
    
    let feedUrl = `/video_feed?model=${encodeURIComponent(model)}&tracker=${encodeURIComponent(tracker)}&conf=${conf}`;
    if (currentVideoFile) {
        feedUrl += `&video_file=${encodeURIComponent(currentVideoFile)}`;
    }
    
    // Start WebSocket listener for statistics
    connectWebSocket();
    
    // Update player and UI
    videoPlayer.src = feedUrl;
    videoPlayer.classList.remove('hidden');
    placeholderText.classList.add('hidden');
    
    streamStatus.textContent = "Tracking";
    streamStatus.classList.add('active');
    isStreaming = true;
    
    // Clear charts for new run
    classChart.data.labels = [];
    classChart.data.datasets[0].data = [];
    classChart.update();
    
    timelineChart.data.labels = [];
    timelineChart.data.datasets[0].data = [];
    timelineChart.data.datasets[1].data = [];
    timelineChart.update();
}

async function stopTracking() {
    if (!isStreaming) return;
    
    // Reset player and UI
    videoPlayer.src = "";
    videoPlayer.classList.add('hidden');
    placeholderText.classList.remove('hidden');
    
    streamStatus.textContent = "Offline";
    streamStatus.classList.remove('active');
    isStreaming = false;
    
    // Send stop request to release backend resource
    try {
        await fetch('/stop', { method: 'POST' });
    } catch (err) {
        console.error("Error stopping tracking session:", err);
    }
    
    // Disconnect WebSocket
    if (wsConnection) {
        wsConnection.close();
        wsConnection = null;
    }
}

function connectWebSocket() {
    if (wsConnection) {
        wsConnection.close();
    }
    
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    wsConnection = new WebSocket(wsUrl);
    
    wsConnection.onopen = () => {
        console.log("WebSocket metrics channel connected.");
    };
    
    wsConnection.onmessage = (event) => {
        const stats = JSON.parse(event.data);
        updateDashboard(stats);
    };
    
    wsConnection.onclose = () => {
        console.log("WebSocket metrics channel closed.");
    };
    
    wsConnection.onerror = (err) => {
        console.error("WebSocket error:", err);
    };
}

function updateDashboard(stats) {
    // 1. Update text fields
    statTracks.textContent = stats.active_tracks;
    statFps.textContent = stats.fps;
    statLatency.textContent = stats.latency_ms;
    
    // 2. Update Class Chart (Bar)
    const classData = stats.class_counts;
    const sortedClasses = Object.keys(classData).sort();
    
    classChart.data.labels = sortedClasses;
    classChart.data.datasets[0].data = sortedClasses.map(cls => classData[cls]);
    classChart.update('none'); // Update without animation for performance
    
    // 3. Update Timeline Chart (Line)
    const maxDataPoints = 40;
    timelineChart.data.labels.push(stats.frame);
    timelineChart.data.datasets[0].data.push(stats.active_tracks);
    timelineChart.data.datasets[1].data.push(stats.fps);
    
    // Limit data points to prevent memory overflow
    if (timelineChart.data.labels.length > maxDataPoints) {
        timelineChart.data.labels.shift();
        timelineChart.data.datasets[0].data.shift();
        timelineChart.data.datasets[1].data.shift();
    }
    timelineChart.update('none');
}
