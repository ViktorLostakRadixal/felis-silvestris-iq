document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const startScreen = document.getElementById('start-screen');
    const testArea = document.getElementById('test-area');
    const startButton = document.getElementById('start-button');
    const sessionIdInput = document.getElementById('session-id-input');
    const durationInput = document.getElementById('duration-input');

    // Test Configuration
    const TARGET_APPEAR_DELAY_MS = 2000; // Time between targets

    // State Variables
    let sessionData = {};
    let isTestRunning = false;
    let testTimeout;

    // =========================================================================
    // EVENT LOGGING
    // =========================================================================
    function initSessionLog() {
        sessionData = {
            sessionId: sessionIdInput.value || `Session_${new Date().toISOString()}`,
            machineName: '', // This is hard to get reliably from a browser, can be added manually
            userAgent: navigator.userAgent,
            clientStartTime: new Date().toISOString(),
            clientEndTime: null,
            events: []
        };
        logEvent('SessionStart', { viewport: { width: window.innerWidth, height: window.innerHeight } });
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
    function startTest() {
        if (!sessionIdInput.value) {
            alert('Please enter an Experiment ID before starting.');
            return;
        }

        initSessionLog();
        isTestRunning = true;

        // BUG FIX: Ensure the start screen is hidden and test area is shown *before* going fullscreen.
        startScreen.classList.add('hidden');
        testArea.classList.remove('hidden');

        // Switch to fullscreen
        document.documentElement.requestFullscreen().catch(err => {
            console.error(`Error attempting to enable full-screen mode: ${err.message} (${err.name})`);
        });

        // Start the test cycle
        showNewTarget();

        const duration = parseInt(durationInput.value, 10);
        if (duration > 0) {
            testTimeout = setTimeout(endTest, duration * 1000);
            logEvent('TestAutoStart', { duration: duration });
        } else {
            logEvent('TestManualStart', { duration: 'infinite' });
        }
    }

    function endTest() {
        if (!isTestRunning) return;
        isTestRunning = false;

        clearTimeout(testTimeout);
        if (document.fullscreenElement) {
            document.exitFullscreen();
        }

        // BUG FIX: Ensure the test area is hidden and start screen is shown again.
        testArea.classList.add('hidden');
        startScreen.classList.remove('hidden');
        testArea.innerHTML = ''; // Clear any remaining targets

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

        const x = Math.random() * (window.innerWidth - 100) + 50;
        const y = Math.random() * (window.innerHeight - 100) + 50;
        target.style.left = `${x}px`;
        target.style.top = `${y}px`;

        target.addEventListener('pointerdown', (e) => handleTargetHit(e, target));

        testArea.appendChild(target);

        // FEATURE ADDED: Logging the appearance and position of the new target.
        logEvent('TargetSpawned', { x: x, y: y, size: 100 });
    }

    function handleTargetHit(event, targetElement) {
        if (!isTestRunning) return;

        logEvent('TargetHit', {
            x: event.clientX,
            y: event.clientY,
            targetX: parseFloat(targetElement.style.left),
            targetY: parseFloat(targetElement.style.top)
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

    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
            handleManualStop();
        }
    });

    testArea.addEventListener('pointerdown', (e) => {
        if (isTestRunning && !e.target.classList.contains('target')) {
            logEvent('BackgroundTap', { x: e.clientX, y: e.clientY });
        }
    });

    window.addEventListener('resize', () => {
        if (isTestRunning) {
            logEvent('ViewportChange', { width: window.innerWidth, height: window.innerHeight });
        }
    });

    document.addEventListener('visibilitychange', () => {
        if (isTestRunning) {
            logEvent('VisibilityChange', { isVisible: !document.hidden });
        }
    });

    // =========================================================================
    // SERVER COMMUNICATION
    // =========================================================================
    async function sendDataToServer() {
        try {
            const response = await fetch('/api/log', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(sessionData),
            });
            if (response.ok) {
                const result = await response.json();
                console.log('Server response:', result.message);
                alert('Session data saved successfully!');
            } else {
                console.error('Failed to save session data.', response.statusText);
                alert('Error: Could not save session data to the server.');
            }
        } catch (error) {
            console.error('Network error:', error);
            alert('Error: Could not connect to the server.');
        }
    }
});
