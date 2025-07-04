// DOM Elements
const loginForm = document.getElementById('loginForm');
const pinError = document.getElementById('pinError');
const attemptsRemaining = document.getElementById('attemptsRemaining');
const lockoutNotice = document.getElementById('lockoutNotice');
let pinInputs = [];

// Check PIN status periodically
async function checkPinStatus() {
    try {
        const response = await fetch('/api/pin-required');
        const { locked, lockoutMinutes, attemptsLeft } = await response.json();
        
        if (locked) {
            showLockout(lockoutMinutes);
            pinInputs.forEach(input => input.disabled = true);
        } else {
            pinInputs.forEach(input => input.disabled = false);
            if (attemptsLeft < 5) {
                showError('', attemptsLeft);
            }
        }
    } catch (error) {
        console.error('Failed to check PIN status:', error);
    }
}

// PIN Management
async function setupPinInputs(data) {
    try {
        const container = document.querySelector('.pin-input-container');
        container.innerHTML = '';
        
        // Create PIN inputs
        for (let i = 0; i < data.length; i++) {
            const input = document.createElement('input');
            input.type = 'password';
            input.maxLength = 1;
            input.pattern = '[0-9]';
            input.inputMode = 'numeric';
            input.className = 'pin-input';
            input.setAttribute('aria-label', `PIN digit ${i + 1}`);
            container.appendChild(input);
            
            if (data.locked) {
                input.disabled = true;
            }
        }
        
        // Update pinInputs array
        pinInputs = [...document.querySelectorAll('.pin-input')];
        setupPinInputListeners();
        
        if (data.locked) {
            showLockout(data.lockoutMinutes);
        } else {
            if (data.attemptsLeft < 5) {
                showError('', data.attemptsLeft);
            }
            pinInputs[0].focus();
        }

        // Start periodic status check
        setInterval(checkPinStatus, 10000); // Check every 10 seconds
    } catch (error) {
        showError('Failed to initialize PIN inputs');
    }
}

function setupPinInputListeners() {
    pinInputs.forEach((input, index) => {
        input.addEventListener('input', (e) => {
            const value = e.target.value;
            
            // Add/remove the has-value class
            input.classList.toggle('has-value', value !== '');
            
            if (value && index < pinInputs.length - 1) {
                pinInputs[index + 1].focus();
            }
            
            // Check if all inputs are filled
            const pin = pinInputs.map(input => input.value).join('');
            if (pin.length === pinInputs.length) {
                verifyPin(pin);
            }
        });

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' && !e.target.value && index > 0) {
                pinInputs[index - 1].focus();
                pinInputs[index - 1].classList.remove('has-value');
            }
        });

        input.addEventListener('keypress', (e) => {
            if (!/[0-9]/.test(e.key)) {
                e.preventDefault();
            }
        });

        input.addEventListener('paste', (e) => {
            e.preventDefault();
            const text = e.clipboardData.getData('text/plain');
            if (text != null && text.length > 0 && /^\d+$/.test(text)) {
                for (let i = index; i < Math.min(index + text.length, pinInputs.length); i++) {
                    pinInputs[i].value = text[i - index];
                    pinInputs[i].focus();
                }
                const pin = pinInputs.map(input => input.value).join('');
                if (pin.length === pinInputs.length) {
                    verifyPin(pin);
                }
            }
        })
    });
}

function showError(message, attemptsLeft = null) {
    if (message) {
        pinError.textContent = message;
        pinError.setAttribute('aria-hidden', 'false');
    } else {
        pinError.setAttribute('aria-hidden', 'true');
    }
    
    // Handle attempts remaining
    if (attemptsLeft !== null) {
        attemptsRemaining.textContent = `${attemptsLeft} attempt${attemptsLeft === 1 ? '' : 's'} remaining`;
        attemptsRemaining.setAttribute('aria-hidden', 'false');
    } else {
        attemptsRemaining.setAttribute('aria-hidden', 'true');
    }
}

function showLockout(minutes) {
    lockoutNotice.textContent = `Too many attempts. Please try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`;
    lockoutNotice.setAttribute('aria-hidden', 'false');
    pinError.setAttribute('aria-hidden', 'true');
    attemptsRemaining.setAttribute('aria-hidden', 'true');
}

function clearErrors() {
    pinError.setAttribute('aria-hidden', 'true');
    attemptsRemaining.setAttribute('aria-hidden', 'true');
    lockoutNotice.setAttribute('aria-hidden', 'true');
}

function clearInputs() {
    pinInputs.forEach(input => {
        input.value = '';
        input.classList.remove('has-value');
    });
    clearErrors();
    pinInputs[0].focus();
}

async function verifyPin(pin) {
    try {
        const response = await fetch('/api/verify-pin', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ pin })
        });
        
        const data = await response.json();
        
        if (data.valid) {
            // Use replace to prevent back button from returning to login
            window.location.replace('/');
            return;
        }
        
        if (data.locked) {
            showLockout(data.lockoutMinutes);
            pinInputs.forEach(input => input.disabled = true);
        } else {
            showError(data.error, data.attemptsLeft);
        }
        clearInputs();

        // Check status immediately after a failed attempt
        await checkPinStatus();
    } catch (error) {
        showError('Failed to verify PIN');
        clearInputs();
    }
}

// Initialize only if we need to be on this page
async function init() {
    try {
        await fetch('/api/pin-required')
        .then(resp => {
            if (resp.status === 403) throw new Error(`Forbbiden: ${resp.status}`);
            else if (resp.status >= 400) throw new Error(resp.status);

            return resp.json();
        })
        .then(data => {          
            if (!data.required) {
                window.location.replace('/');
                return;
            }
            
            // Only set up PIN inputs if we actually need them
            setupPinInputs(data);
        })
        .catch(err => {
            console.error(err);
            const pinContainer = document.getElementById('loginForm');
            if (pinContainer) {
                pinContainer.style.opacity = '0.5';
                pinContainer.style.pointerEvents = 'none';
                const pinDescription = document.getElementById('pin-description');
                pinDescription.textContent = '';
            }
            showError(err);
        });

    } catch (error) {
        showError(`Failed to initialize login`);
        console.error(error);
    }
}

// Start initialization
init(); 
