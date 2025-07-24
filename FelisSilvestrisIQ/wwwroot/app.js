document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const startScreen = document.getElementById('start-screen');
    const testArea = document.getElementById('test-area');
    const startButton = document.getElementById('start-button');
    const sessionIdInput = document.getElementById('session-id-input');
    const durationInput = document.getElementById('duration-input');
    const toast = document.getElementById('toast-notification');

    // Test Configuration
    const TARGET_APPEAR_DELAY_MS = 2000;
    const TARGET_SIZE_PX = 100;
    const TARGET_COLOR = 'white';

    // State Variables
    let sessionData = {};
    let isTestRunning = false;
    let testTimeout;

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
    // EVENT LOGGING
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

            showNewTarget();

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
            isTestRunning = false;
            // Revert UI if fullscreen fails
            testArea.classList.add('hidden');
            startScreen.classList.remove('hidden');
        }
    }

    function endTest() {
        if (!isTestRunning) return;
        isTestRunning = false;

        clearTimeout(testTimeout);

        if (document.fullscreenElement) {
            document.exitFullscreen();
        }

        // Delay UI changes slightly to avoid race conditions with exiting fullscreen
        setTimeout(() => {
            testArea.classList.add('hidden');
            startScreen.classList.remove('hidden');
            testArea.innerHTML = '';
        }, 100); // 100ms delay

        sessionData.clientEndTime = new Date().toISOString();
        logEvent('TestEnd', { reason: 'Duration elapsed or manually stopped' });

        sendDataToServer();
    }

    function handleManualStop() {
        if (isTestRunning) {
            logEvent('TestInterrupted', { reason: 'User pressed Escape' });
            endTest();
        }
    }

    function showNewTarget() {
        if (!isTestRunning) return;

        testArea.innerHTML = '';

        const target = document.createElement('div');
        target.className = 'target';

        const x = Math.random() * (window.innerWidth - TARGET_SIZE_PX);
        const y = Math.random() * (window.innerHeight - TARGET_SIZE_PX);
        target.style.left = `${x}px`;
        target.style.top = `${y}px`;
        target.style.width = `${TARGET_SIZE_PX}px`;
        target.style.height = `${TARGET_SIZE_PX}px`;
        target.style.backgroundColor = TARGET_COLOR;

        target.addEventListener('pointerdown', (e) => handleTargetHit(e, target));

        testArea.appendChild(target);

        logEvent('TargetSpawned', {
            x: Math.round(x),
            y: Math.round(y),
            size: TARGET_SIZE_PX,
            color: TARGET_COLOR
        });
    }

    function handleTargetHit(event, targetElement) {
        if (!isTestRunning) return;

        logEvent('TargetHit', {
            x: event.clientX,
            y: event.clientY
        });

        targetElement.style.backgroundColor = 'lime';
        targetElement.style.transform = 'scale(1.2)';

        setTimeout(() => {
            showNewTarget();
        }, TARGET_APPEAR_DELAY_MS);
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
    // SERVER COMMUNICATION
    // =========================================================================
    async function sendDataToServer() {
        try {
            const response = await fetch('/api/log', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(sessionData),
            });
            if (response.ok) {
                // MODIFIED: Parse the JSON response to get the ID
                const result = await response.json();
                console.log('Server response:', result);
                // MODIFIED: Display the returned ID in the toast notification
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
