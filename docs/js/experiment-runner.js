/**
 * Three Rooms Research Group - Experiment Runner
 * Form handling and experiment initialization
 */

document.addEventListener('DOMContentLoaded', function() {
    initializeForm();
});

function initializeForm() {
    const form = document.getElementById('experiment-form');
    if (!form) return;

    form.addEventListener('submit', handleFormSubmit);
    
    // Validate required fields on blur
    const requiredFields = form.querySelectorAll('[required]');
    requiredFields.forEach(field => {
        field.addEventListener('blur', function() {
            validateField(this);
        });
    });
}

function validateField(field) {
    if (!field.value.trim() && field.hasAttribute('required')) {
        field.classList.add('error');
        return false;
    } else {
        field.classList.remove('error');
        return true;
    }
}

function handleFormSubmit(event) {
    event.preventDefault();
    
    const formData = {
        // Section 1: About Your Agent
        agentName: document.getElementById('agent-name').value.trim(),
        agentDescription: document.getElementById('agent-description').value.trim(),
        country: document.getElementById('country').value.trim(),
        notes: document.getElementById('notes').value.trim(),
        
        // Section 2: Technical Configuration
        provider: document.getElementById('provider').value,
        model: document.getElementById('model').value.trim(),
        systemPromptType: document.getElementById('system-prompt-type').value,
        temperature: parseFloat(document.getElementById('temperature').value) || 0.7
    };
    
    // Validate required fields
    if (!formData.agentName) {
        alert('Please provide an agent name.');
        document.getElementById('agent-name').focus();
        return;
    }
    
    if (!formData.provider) {
        alert('Please select a provider.');
        document.getElementById('provider').focus();
        return;
    }
    
    if (!formData.model) {
        alert('Please provide a model name.');
        document.getElementById('model').focus();
        return;
    }
    
    // Store configuration
    storeConfiguration(formData);
    
    // Initialize experiment
    initializeExperiment(formData);
}

function storeConfiguration(config) {
    // Store in localStorage for persistence
    localStorage.setItem('threeRoomsConfig', JSON.stringify(config));
    console.log('Configuration stored:', config);
}

function initializeExperiment(config) {
    console.log('Initializing experiment with config:', config);
    
    // Hide form, show experiment interface
    document.getElementById('config-section').style.display = 'none';
    document.getElementById('experiment-section').style.display = 'block';
    
    // Start the experiment
    startExperiment(config);
}

function startExperiment(config) {
    // Experiment logic will go here
    // This is where the three rooms interaction begins
    console.log('Starting Three Rooms experiment...');
    
    // Display welcome message
    displayMessage(`Welcome, ${config.agentName}! The experiment is beginning...`);
}

function displayMessage(message) {
    const messageArea = document.getElementById('message-area');
    if (messageArea) {
        const messageEl = document.createElement('div');
        messageEl.className = 'message';
        messageEl.textContent = message;
        messageArea.appendChild(messageEl);
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        initializeForm,
        handleFormSubmit,
        startExperiment
    };
}
