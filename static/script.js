


// Session management
let currentSessionId = null;
let sessions = [];

// DOM elements
const chatMessages = document.getElementById('chat-messages');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');
const clearBtn = document.getElementById('clear-btn');
const markdownHelpBtn = document.getElementById('markdown-help-btn');
const markdownModal = document.getElementById('markdown-modal');
const exportBtn = document.getElementById('export-btn');
const exportModal = document.getElementById('export-modal');
const toggleSidebarBtn = document.getElementById('toggle-sidebar');
const sidebar = document.getElementById('sidebar');
const newChatBtn = document.getElementById('new-chat-btn');
const sessionsList = document.getElementById('sessions-list');
const searchInput = document.getElementById('search-input');

// Initialize
window.addEventListener('load', () => {
    initializeApp();
});

async function initializeApp() {
    // Generate new session ID or restore from localStorage
    currentSessionId = localStorage.getItem('currentSessionId');
    if (!currentSessionId) {
        currentSessionId = generateSessionId();
        localStorage.setItem('currentSessionId', currentSessionId);
    }
    
    // Load sessions
    await loadSessions();
    
    // Load current session messages if exists
    const currentSession = sessions.find(s => s.id === currentSessionId);
    if (currentSession) {
        await loadSession(currentSessionId);
    }
    
    // Focus on input
    userInput.focus();
    
    // Setup event listeners
    setupEventListeners();
}

function generateSessionId() {
    return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

function setupEventListeners() {
    // Auto-resize textarea
    userInput.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = (this.scrollHeight) + 'px';
    });
    
    // Send message on Enter key (Shift+Enter for new line)
    userInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });
    
    // Button clicks
    sendBtn.addEventListener('click', sendMessage);
    clearBtn.addEventListener('click', clearChat);
    newChatBtn.addEventListener('click', createNewChat);
    toggleSidebarBtn.addEventListener('click', toggleSidebar);
    
    // Search functionality
    let searchTimeout;
    searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            searchConversations(e.target.value);
        }, 300);
    });
    
    // Modals
    markdownHelpBtn.addEventListener('click', () => {
        markdownModal.style.display = 'block';
    });
    
    exportBtn.addEventListener('click', () => {
        exportModal.style.display = 'block';
    });
    
    // Close modals
    document.querySelectorAll('.close').forEach(closeBtn => {
        closeBtn.addEventListener('click', (e) => {
            const modalId = e.target.getAttribute('data-modal') || e.target.closest('.modal').id;
            document.getElementById(modalId || e.target.closest('.modal').id).style.display = 'none';
        });
    });
    
    window.addEventListener('click', (event) => {
        if (event.target.classList.contains('modal')) {
            event.target.style.display = 'none';
        }
    });
    
    // Export options
    document.querySelectorAll('.export-option').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const format = e.currentTarget.getAttribute('data-format');
            exportChat(format);
        });
    });
}

// Session Management Functions
async function loadSessions() {
    try {
        const response = await fetch('/sessions');
        const data = await response.json();
        
        if (response.ok) {
            sessions = data.sessions;
            renderSessions();
        }
    } catch (error) {
        console.error('Error loading sessions:', error);
    }
}

function renderSessions() {
    if (sessions.length === 0) {
        sessionsList.innerHTML = `
            <div class="empty-state">
                <div class="empty-state-icon">💬</div>
                <div class="empty-state-text">No chat history yet</div>
            </div>
        `;
        return;
    }
    
    sessionsList.innerHTML = sessions.map(session => `
        <div class="session-item ${session.id === currentSessionId ? 'active' : ''}" 
             data-session-id="${session.id}">
            <div class="session-title">${escapeHtml(session.title)}</div>
            <div class="session-meta">
                <span>${formatDate(session.updated_at)}</span>
                <span>${session.message_count} messages</span>
            </div>
            <button class="session-delete" data-session-id="${session.id}" title="Delete">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
            </button>
        </div>
    `).join('');
    
    // Add click handlers
    document.querySelectorAll('.session-item').forEach(item => {
        item.addEventListener('click', (e) => {
            if (!e.target.closest('.session-delete')) {
                const sessionId = item.getAttribute('data-session-id');
                loadSession(sessionId);
            }
        });
    });
    
    // Add delete handlers
    document.querySelectorAll('.session-delete').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            e.stopPropagation();
            const sessionId = btn.getAttribute('data-session-id');
            if (confirm('Delete this conversation?')) {
                await deleteSession(sessionId);
            }
        });
    });
}

async function loadSession(sessionId) {
    try {
        const response = await fetch(`/sessions/${sessionId}`);
        const data = await response.json();
        
        if (response.ok) {
            currentSessionId = sessionId;
            localStorage.setItem('currentSessionId', sessionId);
            
            // Clear chat messages
            chatMessages.innerHTML = '';
            
            // Load messages
            data.messages.forEach(msg => {
                addMessage(
                    msg.formatted_content || msg.content, 
                    msg.sender, 
                    true
                );
            });
            
            // Update active session in sidebar
            document.querySelectorAll('.session-item').forEach(item => {
                item.classList.toggle('active', 
                    item.getAttribute('data-session-id') === sessionId);
            });
            
            // If no messages, show welcome message
            if (data.messages.length === 0) {
                showWelcomeMessage();
            }
        }
    } catch (error) {
        console.error('Error loading session:', error);
    }
}

async function createNewChat() {
    currentSessionId = generateSessionId();
    localStorage.setItem('currentSessionId', currentSessionId);
    
    // Clear chat
    chatMessages.innerHTML = '';
    showWelcomeMessage();
    
    // Update sidebar
    await loadSessions();
    
    // Focus input
    userInput.focus();
}

async function deleteSession(sessionId) {
    try {
        const response = await fetch(`/sessions/${sessionId}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            // If deleting current session, create new one
            if (sessionId === currentSessionId) {
                createNewChat();
            } else {
                // Just reload sessions
                await loadSessions();
            }
        }
    } catch (error) {
        console.error('Error deleting session:', error);
    }
}

function showWelcomeMessage() {
    const welcomeHTML = `
        <div class="message assistant-message">
            <div class="message-content">
                <p>Hello! I'm your AI assistant powered by Gemini. I support <strong>markdown formatting</strong>!</p>
                <p>Your conversations are automatically saved. You can:</p>
                <ul>
                    <li>View chat history in the sidebar</li>
                    <li>Search through past conversations</li>
                    <li>Export chats as JSON or TXT</li>
                    <li>Continue previous conversations</li>
                </ul>
            </div>
        </div>
    `;
    chatMessages.innerHTML = welcomeHTML;
}

function toggleSidebar() {
    sidebar.classList.toggle('hidden');
}

// Continue in next response...

// Message Handling Functions
async function sendMessage() {
    const message = userInput.value.trim();
    
    if (!message) return;
    
    // Disable input and button
    userInput.disabled = true;
    sendBtn.disabled = true;
    
    // Add user message to chat (with markdown formatting)
    addMessage(message, 'user');
    
    // Clear input and reset height
    userInput.value = '';
    userInput.style.height = 'auto';
    
    // Show typing indicator
    const typingIndicator = showTypingIndicator();
    
    try {
        // Send message to backend
        const response = await fetch('/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                message: message,
                session_id: currentSessionId
            })
        });
        
        const data = await response.json();
        
        // Remove typing indicator
        typingIndicator.remove();
        
        if (response.ok) {
            // Add assistant response (already formatted by backend)
            addMessage(data.response, 'assistant', true);
            
            // Reload sessions to update the list
            await loadSessions();
        } else {
            // Show error message
            addMessage('Sorry, an error occurred: ' + (data.error || 'Unknown error'), 'assistant');
        }
    } catch (error) {
        // Remove typing indicator
        typingIndicator.remove();
        
        // Show error message
        addMessage('Sorry, I encountered an error. Please try again.', 'assistant');
        console.error('Error:', error);
    } finally {
        // Re-enable input and button
        userInput.disabled = false;
        sendBtn.disabled = false;
        userInput.focus();
    }
}

// Add message to chat
async function addMessage(message, sender, isFormatted = false) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}-message`;
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    
    if (isFormatted) {
        // Message is already HTML formatted
        contentDiv.innerHTML = message;
    } else if (sender === 'user') {
        // Format user messages with basic markdown
        const formatted = await formatUserMessage(message);
        contentDiv.innerHTML = formatted;
    } else {
        // Plain text for errors
        contentDiv.textContent = message;
    }
    
    messageDiv.appendChild(contentDiv);
    chatMessages.appendChild(messageDiv);
    
    // Add copy buttons to code blocks
    addCopyButtons(contentDiv);
    
    // Scroll to bottom
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Format user messages with basic markdown
async function formatUserMessage(text) {
    try {
        const response = await fetch('/format-preview', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ text: text })
        });
        
        if (response.ok) {
            const data = await response.json();
            return data.formatted;
        }
    } catch (error) {
        console.error('Error formatting message:', error);
    }
    
    // Fallback to basic formatting
    return escapeHtml(text).replace(/\n/g, '<br>');
}

// Add copy buttons to code blocks
function addCopyButtons(container) {
    const codeBlocks = container.querySelectorAll('pre');
    
    codeBlocks.forEach(block => {
        // Skip if button already exists
        if (block.querySelector('.copy-btn')) return;
        
        const copyBtn = document.createElement('button');
        copyBtn.className = 'copy-btn';
        copyBtn.textContent = 'Copy';
        
        copyBtn.addEventListener('click', () => {
            const code = block.textContent.replace('Copy', '').trim();
            navigator.clipboard.writeText(code).then(() => {
                copyBtn.textContent = 'Copied!';
                setTimeout(() => {
                    copyBtn.textContent = 'Copy';
                }, 2000);
            }).catch(err => {
                console.error('Failed to copy:', err);
                copyBtn.textContent = 'Failed';
            });
        });
        
        block.style.position = 'relative';
        block.appendChild(copyBtn);
    });
}

// Show typing indicator
function showTypingIndicator() {
    const typingDiv = document.createElement('div');
    typingDiv.className = 'message assistant-message';
    typingDiv.innerHTML = `
        <div class="typing-indicator">
            <span></span>
            <span></span>
            <span></span>
        </div>
    `;
    chatMessages.appendChild(typingDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    return typingDiv;
}

// Clear chat function
async function clearChat() {
    if (!confirm('Are you sure you want to clear this chat? This will delete the entire conversation.')) {
        return;
    }
    
    try {
        const response = await fetch('/clear', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                session_id: currentSessionId
            })
        });
        
        if (response.ok) {
            // Create new chat
            await createNewChat();
        }
    } catch (error) {
        console.error('Error clearing chat:', error);
        alert('Failed to clear chat. Please try again.');
    }
}

// Search functionality
async function searchConversations(query) {
    if (!query.trim()) {
        await loadSessions();
        return;
    }
    
    try {
        const response = await fetch('/search', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ query: query })
        });
        
        const data = await response.json();
        
        if (response.ok && data.results.length > 0) {
            renderSearchResults(data.results, query);
        } else {
            sessionsList.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">🔍</div>
                    <div class="empty-state-text">No results found for "${escapeHtml(query)}"</div>
                </div>
            `;
        }
    } catch (error) {
        console.error('Error searching:', error);
    }
}

function renderSearchResults(results, query) {
    const groupedResults = {};
    
    // Group results by session
    results.forEach(result => {
        if (!groupedResults[result.session_id]) {
            groupedResults[result.session_id] = {
                title: result.session_title,
                messages: []
            };
        }
        groupedResults[result.session_id].messages.push(result);
    });
    
    sessionsList.innerHTML = Object.entries(groupedResults).map(([sessionId, data]) => `
        <div class="session-item" data-session-id="${sessionId}">
            <div class="session-title">${escapeHtml(data.title)}</div>
            <div class="search-results">
                ${data.messages.slice(0, 2).map(msg => `
                    <div class="search-result">
                        <small>${msg.sender}: ${highlightText(escapeHtml(msg.content), query)}</small>
                    </div>
                `).join('')}
                ${data.messages.length > 2 ? `<small>... and ${data.messages.length - 2} more matches</small>` : ''}
            </div>
        </div>
    `).join('');
    
    // Add click handlers
    document.querySelectorAll('.session-item').forEach(item => {
        item.addEventListener('click', () => {
            const sessionId = item.getAttribute('data-session-id');
            loadSession(sessionId);
            searchInput.value = '';
        });
    });
}

// Export functionality
async function exportChat(format) {
    try {
        window.location.href = `/export/${currentSessionId}/${format}`;
        exportModal.style.display = 'none';
    } catch (error) {
        console.error('Error exporting chat:', error);
        alert('Failed to export chat. Please try again.');
    }
}

// Utility functions
function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function highlightText(text, query) {
    const regex = new RegExp(`(${query})`, 'gi');
    return text.replace(regex, '<span class="search-highlight">$1</span>');
}

function formatDate(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString();
}

// Handle connection errors
window.addEventListener('online', () => {
    console.log('Connection restored');
});

window.addEventListener('offline', () => {
    addMessage('You appear to be offline. Please check your internet connection.', 'assistant');
});

// Auto-save indicator
let autoSaveTimeout;
function showAutoSave() {
    const indicator = document.createElement('div');
    indicator.className = 'auto-save-indicator';
    indicator.textContent = 'Saved';
    document.body.appendChild(indicator);
    
    setTimeout(() => {
        indicator.remove();
    }, 2000);
}

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    // Ctrl/Cmd + K to focus search
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        searchInput.focus();
    }
    
    // Ctrl/Cmd + N for new chat
    if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        createNewChat();
    }
    
    // Escape to close modals
    if (e.key === 'Escape') {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.style.display = 'none';
        });
    }
});