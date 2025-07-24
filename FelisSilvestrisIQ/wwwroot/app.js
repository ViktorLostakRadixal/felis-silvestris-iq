document.addEventListener('DOMContentLoaded', () => {
    // === DOM Elements ===
    const screens = {
        setup: document.getElementById('setup-screen'),
        qrCode: document.getElementById('qr-code-screen'),
        test: document.getElementById('test-area')
    };
    const setupInput = document.getElementById('setup-input');
    const locationInput = document.getElementById('location-input');
    const dbStatusElement = document.getElementById('db-status');
    const prepareButton = document.getElementById('prepare-button');
    const qrCanvas = document.getElementById('qr-code-canvas');
    const uuidDisplay = document.getElementById('session-uuid-display');
    const startTestButton = document.getElementById('start-test-button');
    const statusIndicator = document.getElementById('status-indicator');

    // === State Variables ===
    let sessionUUID = null;
    let clientStartTimeEpoch = null;
    let isTestRunning = false;
    let eventBuffer = [];
    let dataUpdateInterval = null;
    let currentTarget = null;
    const TARGET_SIZE_PX = 100;
    const LOCAL_STORAGE_KEY = 'felisIQ_lastSetup';

    // =========================================================================
    // INITIALIZATION
    // =========================================================================
    function init() {
        const lastSetup = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (lastSetup) {
            setupInput.value = lastSetup;
        }

        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(pos => {
                locationInput.value = `${pos.coords.latitude.toFixed(6)}, ${pos.coords.longitude.toFixed(6)}`;
            }, err => {
                locationInput.value = `Error: ${err.message}`;
            });
        } else {
            locationInput.value = "Geolocation not supported";
        }

        checkDbStatus();
        setInterval(checkDbStatus, 5000);

        prepareButton.addEventListener('click', prepareExperiment);
        startTestButton.addEventListener('click', startTest);
        document.addEventListener('fullscreenchange', handleFullscreenChange);
    }

    // =========================================================================
    // SCREEN & UI MANAGEMENT
    // =========================================================================
    function switchScreen(screenName) {
        Object.keys(screens).forEach(key => {
            screens[key].classList.add('hidden');
        });
        screens[screenName].classList.remove('hidden');
    }

    function setStatusIndicator(state) {
        if (!statusIndicator) return;
        if (state === 'success') {
            statusIndicator.className = 'success';
            setTimeout(() => statusIndicator.className = '', 1500);
        } else if (state === 'error') {
            statusIndicator.className = 'error';
        } else {
            statusIndicator.className = '';
        }
    }

    // =========================================================================
    // EXPERIMENT WORKFLOW
    // =========================================================================
    async function prepareExperiment() {
        const setupInfo = setupInput.value.trim();
        if (!setupInfo) {
            alert('Please fill in the Experimental Setup description.');
            return;
        }

        localStorage.setItem(LOCAL_STORAGE_KEY, setupInfo);
        clientStartTimeEpoch = Date.now();

        const payload = {
            setupInfo: setupInfo,
            locationInfo: {
                latitude: parseFloat(locationInput.value.split(',')[0]) || null,
                longitude: parseFloat(locationInput.value.split(',')[1]) || null,
                error: locationInput.value.startsWith('Error') ? locationInput.value : null
            },
            userAgent: navigator.userAgent,
            device: {
                viewport: { width: window.innerWidth, height: window.innerHeight },
                screen: { width: screen.width, height: screen.height, pixelRatio: window.devicePixelRatio }
            },
            clientStartTime: new Date(clientStartTimeEpoch).toISOString()
        };

        try {
            const response = await fetch('/api/sessions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (!response.ok) throw new Error(`Server error: ${response.statusText}`);
            const result = await response.json();
            sessionUUID = result.id;
            uuidDisplay.textContent = `Session ID: ${sessionUUID}`;
            QRCode.toCanvas(qrCanvas, sessionUUID, { width: 256 });
            switchScreen('qrCode');
        } catch (error) {
            console.error('Failed to prepare experiment:', error);
            alert(`Error preparing session: ${error.message}`);
        }
    }

    async function startTest() {
        isTestRunning = true;
        switchScreen('test');

        // Hide the cursor when the test starts
        document.body.classList.add('test-running');

        try {
            await document.documentElement.requestFullscreen();
            spawnInitialTarget();
            dataUpdateInterval = setInterval(sendBufferedData, 60 * 1000);
        } catch (err) {
            console.error(`Fullscreen request failed: ${err.message}`);
            endTest(true);
        }
    }

    async function endTest(forced = false) {
        if (!isTestRunning) return;
        isTestRunning = false;
        clearInterval(dataUpdateInterval);

        // Show the cursor again when the test ends
        document.body.classList.remove('test-running');

        if (document.fullscreenElement) {
            await document.exitFullscreen();
        }

        // Give the browser a moment to exit fullscreen before saving data
        // and switching screens.
        setTimeout(async () => {
            if (!forced) {
                await sendBufferedData();
            }
            switchScreen('setup');
            sessionUUID = null;
            eventBuffer = [];
            if (screens.test) {
                screens.test.innerHTML = '<div id="status-indicator"></div>'; // Reset test area
            }
        }, 100);
    }

    function handleFullscreenChange() {
        if (!document.fullscreenElement && isTestRunning) {
            logEvent('FullscreenExited', { reason: 'User or browser action' });
            endTest();
        }
    }

    // =========================================================================
    // TEST AREA LOGIC
    // =========================================================================
    function spawnInitialTarget() {
        const target = document.createElement('div');
        target.className = 'target';
        const x = Math.random() * (window.innerWidth - TARGET_SIZE_PX);
        const y = Math.random() * (window.innerHeight - TARGET_SIZE_PX);
        target.style.transform = `translate(${x}px, ${y}px)`;
        target.addEventListener('pointerdown', handleTargetHit);
        screens.test.appendChild(target);
        currentTarget = target;
        logEvent('TargetSpawned', { x: Math.round(x), y: Math.round(y) });
    }

    function handleTargetHit(event) {
        logEvent('TargetHit', { x: event.clientX, y: event.clientY });
        moveTarget();
    }

    function moveTarget() {
        if (!currentTarget) return;
        const transformMatrix = new DOMMatrix(window.getComputedStyle(currentTarget).transform);
        const currentX = transformMatrix.m41;
        const currentY = transformMatrix.m42;
        const screenLongerEdge = Math.max(window.innerWidth, window.innerHeight);
        const minDistance = screenLongerEdge / 3;
        let newX, newY, distance, attempts = 0;
        do {
            newX = Math.random() * (window.innerWidth - TARGET_SIZE_PX);
            newY = Math.random() * (window.innerHeight - TARGET_SIZE_PX);
            distance = Math.sqrt(Math.pow(newX - currentX, 2) + Math.pow(newY - currentY, 2));
            attempts++;
        } while (distance < minDistance && attempts < 50);

        currentTarget.style.transform = `translate(${newX}px, ${newY}px)`;
        logEvent('TargetMoved', { fromX: Math.round(currentX), fromY: Math.round(currentY), toX: Math.round(newX), toY: Math.round(newY) });
    }

    function logEvent(eventType, data) {
        if (!clientStartTimeEpoch) return;
        eventBuffer.push({
            timestamp: Date.now() - clientStartTimeEpoch,
            eventType: eventType,
            data: data || {}
        });
    }

    // =========================================================================
    // DATA SYNC & HEALTH CHECK
    // =========================================================================
    async function sendBufferedData() {
        if (eventBuffer.length === 0 || !sessionUUID) return;

        console.log(`Attempting to sync ${eventBuffer.length} events for session ${sessionUUID}...`);

        const dataToSend = [...eventBuffer];
        try {
            const response = await fetch(`/api/sessions/${sessionUUID}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dataToSend)
            });
            if (response.ok) {
                eventBuffer.splice(0, dataToSend.length);
                setStatusIndicator('success');
                console.log("Sync successful.");
            } else {
                throw new Error(`Server error: ${response.statusText}`);
            }
        } catch (error) {
            console.error('Failed to sync data:', error);
            setStatusIndicator('error');
        }
    }

    async function checkDbStatus() {
        console.log("Checking DB status...");
        try {
            const response = await fetch('/api/healthcheck');
            if (!response.ok) throw new Error('Network response was not ok.');

            const result = await response.json();
            dbStatusElement.textContent = `DB Status: ${result.message}`;
            dbStatusElement.className = result.status === 'OK' ? 'ok' : 'error';

        } catch (error) {
            dbStatusElement.textContent = `DB Status: Connection Error - ${error.message}`;
            dbStatusElement.className = 'error';
        }
    }

    // --- Start the application ---
    init();
});
