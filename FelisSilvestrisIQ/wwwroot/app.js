document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const startScreen = document.getElementById('start-screen');
    const testArea = document.getElementById('test-area');
    const startButton = document.getElementById('start-button');
    const sessionIdInput = document.getElementById('session-id-input');
    const durationInput = document.getElementById('duration-input');
    const toast = document.getElementById('toast-notification');

    // Test Configuration
    const TARGET_SIZE_PX = 100;
    const TARGET_COLOR = 'white';

    // State Variables
    let sessionData = {};
    let isTestRunning = false;
    let testTimeout;
    let currentTarget = null; // Reference to the moving target element

    // =========================================================================
    // UI FEEDBACK
    // =========================================================================
    function showToast(message, type = 'success') {
        toast.textContent = message;
        toast.className = `toast show ${type}`;
        setTimeout(() => {
            toast.className = 'toast hidden';
        }, 5000); // Hide after 5 seconds
    }

    // =========================================================================
    // EVENT LOGGING (No changes here)
    // =========================================================================
    function initSessionLog() {
        sessionData = {
            sessionId: sessionIdInput.value || `Session_${new Date().toISOString()}`,
            userAgent: navigator.userAgent,
            device: {
                viewport: { width: window.innerWidth, height: window.innerHeight },
                screen: {
                    width: window.screen.width,
                    height: window.screen.height,
                    pixelRatio: window.devicePixelRatio
                }
            },
            clientStartTime: new Date().toISOString(),
            clientEndTime: null,
            events: []
        };
        logEvent('SessionStart', sessionData.device);
    }

    function logEvent(eventType, data) {
        if (!sessionData.events) return;
        sessionData.events.push({
            timestamp: Date.now() - new Date(sessionData.clientStartTime).getTime(),
            eventType: eventType,
            data: data
        });
        console.log(`Logged Event: ${eventType}`, data);
    }

    // =========================================================================
    // TEST LOGIC
    // =========================================================================
    async function startTest() {
        if (!sessionIdInput.value) {
            alert('Please enter an Experiment ID before starting.');
            return;
        }

        initSessionLog();
        isTestRunning = true;

        startScreen.classList.add('hidden');
        testArea.classList.remove('hidden');

        try {
            await document.documentElement.requestFullscreen();
            logEvent('FullscreenEntered', {});
            spawnInitialTarget();

            const duration = parseInt(durationInput.value, 10);
            if (duration > 0) {
                testTimeout = setTimeout(endTest, duration * 1000);
                logEvent('TestAutoStart', { duration });
            } else {
                logEvent('TestManualStart', { duration: 'infinite' });
            }
        } catch (err) {
            console.error(`Fullscreen request failed: ${err.message}`);
            logEvent('FullscreenError', { message: err.message });
            endTest(true); // End test immediately if fullscreen fails
        }
    }

    async function endTest(forced = false) {
        if (!isTestRunning) return;
        isTestRunning = false;

        clearTimeout(testTimeout);

        if (document.fullscreenElement) {
            await document.exitFullscreen();
        }

        // ** THE FIX IS HERE **
        // We wrap the UI updates in a setTimeout. This gives the browser a moment
        // to finish exiting fullscreen mode before we try to manipulate the DOM.
        // This prevents the rendering race condition.
        setTimeout(() => {
            testArea.classList.add('hidden');
            startScreen.classList.remove('hidden');
            testArea.innerHTML = ''; // Clean up
            currentTarget = null;

            if (forced) {
                logEvent('TestEnd', { reason: 'Forced stop due to error' });
            } else {
                sessionData.clientEndTime = new Date().toISOString();
                logEvent('TestEnd', { reason: 'Duration elapsed or manually stopped' });
                sendDataToServer(); // Now this will be called when the UI is ready for the toast.
            }
        }, 100); // A 100ms delay is imperceptible but enough for the browser.
    }

    function handleManualStop() {
        if (isTestRunning) {
            logEvent('TestInterrupted', { reason: 'User pressed Escape' });
            endTest();
        }
    }

    function spawnInitialTarget() {
        const target = document.createElement('div');
        target.className = 'target';

        const x = Math.random() * (window.innerWidth - TARGET_SIZE_PX);
        const y = Math.random() * (window.innerHeight - TARGET_SIZE_PX);
        target.style.left = `${x}px`;
        target.style.top = `${y}px`;
        target.style.width = `${TARGET_SIZE_PX}px`;
        target.style.height = `${TARGET_SIZE_PX}px`;
        target.style.backgroundColor = TARGET_COLOR;

        target.addEventListener('pointerdown', handleTargetHit);

        testArea.appendChild(target);
        currentTarget = target;

        logEvent('TargetSpawned', { x: Math.round(x), y: Math.round(y), size: TARGET_SIZE_PX, color: TARGET_COLOR });
    }

    function handleTargetHit(event) {
        if (!isTestRunning) return;

        logEvent('TargetHit', {
            x: event.clientX,
            y: event.clientY
        });

        moveTarget();
    }

    function moveTarget() {
        const currentX = parseFloat(currentTarget.style.left);
        const currentY = parseFloat(currentTarget.style.top);

        const screenLongerEdge = Math.max(window.innerWidth, window.innerHeight);
        const minDistance = screenLongerEdge / 3;

        let newX, newY, distance;
        let attempts = 0;

        do {
            newX = Math.random() * (window.innerWidth - TARGET_SIZE_PX);
            newY = Math.random() * (window.innerHeight - TARGET_SIZE_PX);
            const dx = newX - currentX;
            const dy = newY - currentY;
            distance = Math.sqrt(dx * dx + dy * dy);
            attempts++;
        } while (distance < minDistance && attempts < 50);

        currentTarget.style.left = `${newX}px`;
        currentTarget.style.top = `${newY}px`;

        logEvent('TargetMoved', {
            fromX: Math.round(currentX), fromY: Math.round(currentY),
            toX: Math.round(newX), toY: Math.round(newY)
        });
    }

    // =========================================================================
    // EVENT LISTENERS
    // =========================================================================
    startButton.addEventListener('click', startTest);
    document.addEventListener('keydown', (e) => e.key === 'Escape' && handleManualStop());
    testArea.addEventListener('pointerdown', (e) => {
        if (isTestRunning && !e.target.classList.contains('target')) {
            logEvent('BackgroundTap', { x: e.clientX, y: e.clientY });
        }
    });
    window.addEventListener('resize', () => isTestRunning && logEvent('ViewportChange', { width: window.innerWidth, height: window.innerHeight }));
    document.addEventListener('visibilitychange', () => isTestRunning && logEvent('VisibilityChange', { isVisible: !document.hidden }));

    // =========================================================================
    // SERVER COMMUNICATION (No changes here)
    // =========================================================================
    async function sendDataToServer() {
        try {
            const response = await fetch('/api/log', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(sessionData),
            });
            if (response.ok) {
                const result = await response.json();
                console.log('Server response:', result);
                showToast(`Session data saved! DB ID: ${result.id}`);
            } else {
                console.error('Failed to save session data.', response.statusText);
                showToast(`Error: Could not save data (${response.statusText})`, 'error');
            }
        } catch (error) {
            console.error('Network error:', error);
            showToast('Error: Could not connect to the server.', 'error');
        }
    }
});
