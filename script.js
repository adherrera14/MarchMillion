// Configuration for data source
// In production, change this to your external API endpoint
const DATA_SOURCE_URL = './teams.json'; // Local file for development
// const DATA_SOURCE_URL = 'https://your-api.com/api/teams'; // Production URL

// 2026 NCAA Tournament Bracket Data
// Will be loaded from JSON file
let TOURNAMENT_DATA = null;
let ALL_TEAMS = [];

// Load tournament data from JSON file or external API
async function loadTournamentData() {
    try {
        const response = await fetch(DATA_SOURCE_URL);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        TOURNAMENT_DATA = await response.json();
        
        // Create a flat array of all teams for easier access
        ALL_TEAMS = [];
        TOURNAMENT_DATA.regions.forEach(region => {
            ALL_TEAMS.push(...region.teams);
        });
        
        return true;
    } catch (error) {
        console.error('Error loading tournament data:', error);
        // Show error message to user
        showErrorMessage('Failed to load tournament data. Please refresh the page.');
        return false;
    }
}

// Show error message to user
function showErrorMessage(message) {
    const container = document.querySelector('.container');
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = `
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background-color: #ff4444;
        color: white;
        padding: 15px 30px;
        border-radius: 5px;
        box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5);
        z-index: 10000;
        font-size: 16px;
    `;
    errorDiv.textContent = message;
    container.appendChild(errorDiv);
}

// Rankings storage
let rankings = {}; // Map of team ID to rank (1-64)
let selectedTeam = null;
let isModalOpen = false;
let bracketSubmitted = false; // Track if bracket has been submitted

// Initialize the application
document.addEventListener('DOMContentLoaded', async function() {
    // Show loading indicator
    showLoadingIndicator();
    
    // Load tournament data from JSON file
    const dataLoaded = await loadTournamentData();
    
    // Hide loading indicator
    hideLoadingIndicator();
    
    if (!dataLoaded) {
        return; // Exit if data failed to load
    }
    
    // Load rankings from localStorage if available
    loadRankings();
    
    // Check submission status
    checkSubmissionStatus();
    
    // Initialize bracket display
    renderBracket();
    
    // Set up event listeners
    setupEventListeners();
    
    // Initial update of the UI
    updateRankingsPanel();
    
    // Setup region tabs
    setupRegionTabs();
    
    // Render lines for initially active region
    setTimeout(() => {
        renderActiveBracketLines();
    }, 100);

    window.addEventListener('resize', () => {
        clearTimeout(window._bracketResizeTimer);
        window._bracketResizeTimer = setTimeout(() => {
            renderActiveBracketLines();
        }, 150);
    });
});

// Show loading indicator
function showLoadingIndicator() {
    const container = document.querySelector('.container');
    const loadingDiv = document.createElement('div');
    loadingDiv.id = 'loadingIndicator';
    loadingDiv.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(18, 20, 29, 0.95);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 10000;
        font-size: 24px;
        color: #d4b962;
    `;
    loadingDiv.innerHTML = `
        <div style="text-align: center;">
            <div style="margin-bottom: 20px;">Loading Tournament Data...</div>
            <div style="width: 50px; height: 50px; border: 5px solid #d4b962; border-top-color: transparent; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto;"></div>
        </div>
    `;
    // Add spinning animation
    const style = document.createElement('style');
    style.textContent = '@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }';
    document.head.appendChild(style);
    
    container.appendChild(loadingDiv);
}

// Hide loading indicator
function hideLoadingIndicator() {
    const loadingDiv = document.getElementById('loadingIndicator');
    if (loadingDiv) {
        loadingDiv.remove();
    }
}

// Render the bracket display
function renderBracket() {
    const regionMap = {
        'East Region': 'regionEast',
        'West Region': 'regionWest',
        'Midwest Region': 'regionMidwest',
        'South Region': 'regionSouth'
    };

    const leftToRightRegions = new Set(['East Region', 'South Region']);

    TOURNAMENT_DATA.regions.forEach(region => {
        const regionElement = document.getElementById(regionMap[region.name]);
        regionElement.innerHTML = '';

        // Organize teams by seed (1-16)
        const teamsBySeed = {};
        (region.teams || []).forEach(team => {
            if (!teamsBySeed[team.seed]) {
                teamsBySeed[team.seed] = [];
            }
            teamsBySeed[team.seed].push(team);
        });

        const seedPairs = [
            [1, 16],
            [8, 9],
            [5, 12],
            [4, 13],
            [6, 11],
            [3, 14],
            [7, 10],
            [2, 15]
        ];

        const teamOrder = seedPairs.flat();

        const bracket = document.createElement('div');
        const directionClass = leftToRightRegions.has(region.name) ? 'bracket-left' : 'bracket-right';
        bracket.className = `region-bracket ${directionClass}`;

        const rootStyles = getComputedStyle(document.documentElement);
        const rowHeight = parseFloat(rootStyles.getPropertyValue('--bracket-row-height')) || 44;
        bracket.style.setProperty('--row-height', `${rowHeight}px`);

        const teamColumn = document.createElement('div');
        teamColumn.className = 'team-column';

        teamOrder.forEach(seed => {
            const seedTeams = teamsBySeed[seed] || [];
            seedTeams.forEach(team => {
                const teamSlot = document.createElement('div');
                teamSlot.className = 'team-slot';
                teamSlot.appendChild(createTeamCard(team));
                teamColumn.appendChild(teamSlot);
            });
        });

        const linesWrapper = document.createElement('div');
        linesWrapper.className = 'bracket-lines';
        linesWrapper.dataset.regionName = region.name;

        bracket.appendChild(teamColumn);
        bracket.appendChild(linesWrapper);
        regionElement.appendChild(bracket);
    });

    // Apply disabled state if bracket is submitted
    if (bracketSubmitted) {
        disableBracketEditing();
    }
}

function buildBracketLines(rowHeight, lineWidth) {
    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    const height = rowHeight * 16;
    
    // Calculate x positions based on available width
    const x0 = 0;
    const x1 = lineWidth * 0.15;
    const x2 = lineWidth * 0.38;
    const x3 = lineWidth * 0.62;
    const x4 = lineWidth * 0.85;
    const x5 = lineWidth;
    const stroke = 'rgba(212, 185, 98, 0.6)';

    svg.setAttribute('viewBox', `0 0 ${lineWidth} ${height}`);
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.setAttribute('aria-hidden', 'true');

    const addLine = (xStart, yStart, xEnd, yEnd) => {
        const line = document.createElementNS(svgNS, 'line');
        line.setAttribute('x1', xStart);
        line.setAttribute('y1', yStart);
        line.setAttribute('x2', xEnd);
        line.setAttribute('y2', yEnd);
        line.setAttribute('stroke', stroke);
        line.setAttribute('stroke-width', '2');
        line.setAttribute('stroke-linecap', 'round');
        svg.appendChild(line);
    };

    const roundCenters = (roundSpan) => {
        const matchups = 16 / roundSpan;
        const centers = [];
        for (let i = 0; i < matchups; i++) {
            const startRow = i * roundSpan;
            const center = (startRow + roundSpan / 2) * rowHeight;
            centers.push(center);
        }
        return centers;
    };

    const round1Centers = roundCenters(2);
    const round2Centers = roundCenters(4);
    const round3Centers = roundCenters(8);
    const round4Centers = roundCenters(16);

    for (let i = 0; i < 16; i++) {
        const y = (i + 0.5) * rowHeight;
        addLine(x0, y, x1, y);
    }

    for (let i = 0; i < round1Centers.length; i++) {
        const y1 = (i * 2 + 0.5) * rowHeight;
        const y2 = y1 + rowHeight;
        const center = round1Centers[i];
        addLine(x1, y1, x1, y2);
        addLine(x1, center, x2, center);
    }

    for (let i = 0; i < round2Centers.length; i++) {
        const y1 = round1Centers[i * 2];
        const y2 = round1Centers[i * 2 + 1];
        const center = round2Centers[i];
        addLine(x2, y1, x2, y2);
        addLine(x2, center, x3, center);
    }

    for (let i = 0; i < round3Centers.length; i++) {
        const y1 = round2Centers[i * 2];
        const y2 = round2Centers[i * 2 + 1];
        const center = round3Centers[i];
        addLine(x3, y1, x3, y2);
        addLine(x3, center, x4, center);
    }

    for (let i = 0; i < round4Centers.length; i++) {
        const y1 = round3Centers[0];
        const y2 = round3Centers[1];
        addLine(x4, y1, x4, y2);
    }

    if (round4Centers.length > 0) {
        const championY = round4Centers[0];
        addLine(x4, championY, x5, championY);
    }

    return svg;
}

// Create a team card element
function createTeamCard(team) {
    const card = document.createElement('div');
    card.className = 'team-card';
    card.id = `team-${team.id}`;
    card.dataset.teamId = team.id;

    let html = `<span class="team-name">${team.name}</span>`;

    const rankValue = rankings[team.id] || 0;
    html += `<span class="team-rank">${rankValue}</span>`;
    
    if (rankings[team.id]) {
        card.classList.add('ranked');
    }

    card.innerHTML = html;
    card._clickHandler = () => openRankingModal(team);
    card.addEventListener('click', card._clickHandler);
    
    // Add hover/touch event for team info
    card.addEventListener('mouseenter', () => showTeamInfo(team));
    card.addEventListener('touchstart', (e) => {
        e.stopPropagation();
        showTeamInfo(team);
    });

    return card;
}

// Open ranking modal
function openRankingModal(team) {
    if (bracketSubmitted) {
        alert('Your bracket has been submitted and is locked. You cannot modify your picks.');
        return;
    }

    selectedTeam = team;
    isModalOpen = true;

    const modal = document.getElementById('rankingModal');
    const modalTeamName = document.getElementById('modalTeamName');
    modalTeamName.textContent = `${team.name} (${team.seed} seed)`;

    // Clear error message
    document.getElementById('rankingError').classList.remove('show');
    document.getElementById('rankingError').textContent = '';

    // Generate rank grid
    generateRankGrid(team.id);

    // Show modal
    modal.classList.add('show');
}

// Generate rank grid
function generateRankGrid(teamId) {
    const rankGrid = document.getElementById('rankGrid');
    rankGrid.innerHTML = '';
    const currentRank = rankings[teamId];
    
    // Update the selected rank display
    const selectedRankDisplay = document.getElementById('selectedRankDisplay');
    if (currentRank) {
        selectedRankDisplay.textContent = currentRank;
        selectedRankDisplay.style.display = 'inline';
    } else {
        selectedRankDisplay.textContent = '';
        selectedRankDisplay.style.display = 'none';
    }

    for (let rank = 1; rank <= 64; rank++) {
        const rankOption = document.createElement('div');
        rankOption.className = 'rank-option';
        rankOption.textContent = rank;
        rankOption.dataset.rank = rank;

        // Check if rank is taken by another team
        const isTaken = Object.values(rankings).includes(rank) && rankings[teamId] !== rank;
        
        if (isTaken) {
            rankOption.classList.add('disabled');
        } else if (rank === currentRank) {
            rankOption.classList.add('selected');
        }

        if (!isTaken) {
            rankOption.addEventListener('click', () => selectRankOption(rank));
        }

        rankGrid.appendChild(rankOption);
    }
}

// Select rank from grid
function selectRankOption(rank) {
    const allOptions = document.querySelectorAll('.rank-option');
    allOptions.forEach(opt => opt.classList.remove('selected'));
    
    const selectedOption = document.querySelector(`[data-rank="${rank}"]`);
    if (selectedOption) {
        selectedOption.classList.add('selected');
    }
    
    // Update the selected rank display
    const selectedRankDisplay = document.getElementById('selectedRankDisplay');
    selectedRankDisplay.textContent = rank;
    selectedRankDisplay.style.display = 'inline';
}

// Close modal
function closeRankingModal() {
    const modal = document.getElementById('rankingModal');
    modal.classList.remove('show');
    isModalOpen = false;
    selectedTeam = null;
}

// Confirm ranking
function confirmRank() {
    const errorDiv = document.getElementById('rankingError');
    
    // Get the selected rank from the grid
    const selectedOption = document.querySelector('.rank-option.selected');
    if (!selectedOption) {
        errorDiv.textContent = 'Please select a rank by clicking on one of the numbers below.';
        errorDiv.classList.add('show');
        return;
    }
    
    const rank = parseInt(selectedOption.dataset.rank);

    // Validation
    if (isNaN(rank) || rank < 1 || rank > 64) {
        errorDiv.textContent = 'Please select a valid rank between 1 and 64.';
        errorDiv.classList.add('show');
        return;
    }

    // Check if rank is already taken
    if (Object.values(rankings).includes(rank) && rankings[selectedTeam.id] !== rank) {
        errorDiv.textContent = `Rank ${rank} is already assigned to another team. Please choose a different rank.`;
        errorDiv.classList.add('show');
        return;
    }

    // Assign rank
    rankings[selectedTeam.id] = rank;
    saveRankings();
    updateTeamCard(selectedTeam.id);
    updateRankingsPanel();
    closeRankingModal();
}

// Remove rank
function removeRank() {
    if (selectedTeam && rankings[selectedTeam.id]) {
        delete rankings[selectedTeam.id];
        saveRankings();
        updateTeamCard(selectedTeam.id);
        updateRankingsPanel();
        closeRankingModal();
    }
}

// Update team card after ranking
function updateTeamCard(teamId) {
    const card = document.getElementById(`team-${teamId}`);
    if (!card) return;

    const team = ALL_TEAMS.find(t => t.id === teamId);

    let html = `<span class="team-name">${team.name}</span>`;
    const rankValue = rankings[teamId] || 0;
    html += `<span class="team-rank">${rankValue}</span>`;
    
    if (rankings[teamId]) {
        card.classList.add('ranked');
    } else {
        card.classList.remove('ranked');
    }
    
    card.innerHTML = html;
    
    // Re-attach click listener after innerHTML update
    card.removeEventListener('click', card._clickHandler);
    card._clickHandler = () => openRankingModal(team);
    card.addEventListener('click', card._clickHandler);
    
    // Re-attach hover/touch listeners
    card.addEventListener('mouseenter', () => showTeamInfo(team));
    card.addEventListener('touchstart', (e) => {
        e.stopPropagation();
        showTeamInfo(team);
    });
}

// Show team information in sidebar
function showTeamInfo(team) {
    const teamInfoDiv = document.getElementById('teamInfo');
    const rank = rankings[team.id];
    const initials = getTeamInitials(team.name);
    
    let html = `
        <div class="team-detail">
            <div class="team-info-header">
                <div class="team-logo" aria-hidden="true">
                    <span class="team-logo-text">${initials}</span>
                </div>
                <div class="team-info-name">
                    <strong>${team.name}</strong>
                    <p>Seed: <strong>${team.seed}</strong></p>
                    <p>Record: <strong>${team.stats.wins} wins</strong></p>
                </div>
            </div>
        </div>
    `;

    if (rank) {
        html += `<div class="team-detail" style="background-color: rgba(212, 185, 98, 0.1); padding: 1rem; border-radius: 4px; margin-top: 0.5rem;">
            <p>Current Rank: <strong style="color: #d4b962; font-size: 1.2em;">${rank}/64</strong></p>
        </div>`;
    } else {
        html += `<div class="team-detail" style="background-color: rgba(68, 68, 68, 0.3); padding: 1rem; border-radius: 4px; margin-top: 0.5rem;">
            <p style="color: #999;">Not ranked yet</p>
        </div>`;
    }

    teamInfoDiv.innerHTML = html;
}

function getTeamInitials(name) {
    const words = name.replace(/[^A-Za-z0-9 ]/g, '').trim().split(/\s+/);
    if (words.length === 1) {
        return words[0].slice(0, 2).toUpperCase();
    }
    return (words[0][0] + words[1][0]).toUpperCase();
}

// Update rankings panel
function updateRankingsPanel() {
    const rankedCount = document.getElementById('rankedCount');
    const progressFill = document.getElementById('progressFill');
    const topRankings = document.getElementById('topRankings');
    const submitButton = document.getElementById('exportBracket');
    const submitNote = document.getElementById('submitNote');

    // Update count
    const count = Object.keys(rankings).length;
    rankedCount.textContent = count;
    progressFill.style.width = (count / 64) * 100 + '%';

    const allRanked = count === 64;
    if (submitButton) {
        submitButton.disabled = !allRanked;
        submitButton.setAttribute('aria-disabled', String(!allRanked));
    }
    if (submitNote) {
        submitNote.textContent = allRanked
            ? 'All teams ranked. You can submit your bracket.'
            : 'Rank all 64 teams to enable Submit.';
        submitNote.classList.toggle('is-ready', allRanked);
    }

    // Get top 10 ranked teams
    const topTeams = Object.entries(rankings)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([teamId, rank]) => {
            const team = ALL_TEAMS.find(t => t.id === parseInt(teamId));
            return { teamId: parseInt(teamId), rank, team };
        });

    // Update top rankings display
    if (topTeams.length === 0) {
        topRankings.innerHTML = '<li class="empty-state">No teams ranked yet</li>';
    } else {
        topRankings.innerHTML = topTeams.map(item => 
            `<li><span class="ranking-item-name">${item.rank}. ${item.team.name}</span></li>`
        ).join('');
    }

    // Display team info if a team is selected
    updateTeamInfo();
}

// Update team info panel
function updateTeamInfo() {
    const teamInfoDiv = document.getElementById('teamInfo');

    if (!selectedTeam) {
        teamInfoDiv.innerHTML = '<p class="empty-state">Hover over a team to view details</p>';
        return;
    }

    showTeamInfo(selectedTeam);
}

// Setup event listeners
function setupEventListeners() {
    // Modal close button
    document.querySelector('.close').addEventListener('click', closeRankingModal);

    // Cancel button
    document.getElementById('cancelRank').addEventListener('click', closeRankingModal);

    // Confirm button
    document.getElementById('confirmRank').addEventListener('click', confirmRank);

    // Remove rank button
    document.getElementById('removeRank').addEventListener('click', removeRank);

    // Close modal when clicking outside
    window.addEventListener('click', function(event) {
        const modal = document.getElementById('rankingModal');
        if (event.target === modal) {
            closeRankingModal();
        }
    });

    // Clear all rankings
    document.getElementById('clearAll').addEventListener('click', function() {
        if (confirm('Are you sure you want to clear all rankings? This cannot be undone.')) {
            rankings = {};
            saveRankings();
            renderBracket();
            updateRankingsPanel();
        }
    });

    // Submit bracket
    document.getElementById('exportBracket').addEventListener('click', exportBracket);
}

// Export bracket (shows confirmation dialog)
function exportBracket() {
    if (Object.keys(rankings).length !== 64) {
        alert('Please rank all 64 teams before submitting your bracket.');
        return;
    }

    // Show confirmation dialog
    showConfirmationDialog();
}

// Save rankings to localStorage
function saveRankings() {
    localStorage.setItem('marchMadnessRankings', JSON.stringify(rankings));
}

// Load rankings from localStorage
function loadRankings() {
    const saved = localStorage.getItem('marchMadnessRankings');
    if (saved) {
        const parsed = JSON.parse(saved);
        // Convert keys to integers
        Object.keys(parsed).forEach(key => {
            rankings[parseInt(key)] = parsed[key];
        });
    }
}

// Check if bracket has been submitted
function checkSubmissionStatus() {
    const submitted = localStorage.getItem('marchMadnessBracketSubmitted');
    bracketSubmitted = submitted === 'true';
    updateUIBasedOnSubmissionStatus();
}

// Update UI based on submission status
function updateUIBasedOnSubmissionStatus() {
    const clearAllBtn = document.getElementById('clearAll');
    const submitBtn = document.getElementById('exportBracket');
    const submitNote = document.getElementById('submitNote');
    const submissionStatus = document.getElementById('submissionStatus');
    const leaderboardLink = document.getElementById('leaderboardLink');

    if (bracketSubmitted) {
        // Bracket already submitted - show read-only mode
        clearAllBtn.style.display = 'none';
        submitBtn.style.display = 'none';
        submitNote.style.display = 'none';
        submissionStatus.style.display = 'block';
        submissionStatus.textContent = '✓ Your bracket has been submitted and is locked.';
        submissionStatus.style.color = '#4ade80';

        // Show leaderboard link
        if (leaderboardLink) {
            leaderboardLink.style.display = 'block';
        }

        // Disable bracket editing
        disableBracketEditing();
    } else {
        // Bracket not submitted yet - show editing mode
        clearAllBtn.style.display = 'block';
        submitBtn.style.display = 'block';
        submitNote.style.display = 'block';
        submissionStatus.style.display = 'none';

        // Hide leaderboard link
        if (leaderboardLink) {
            leaderboardLink.style.display = 'none';
        }

        // Enable bracket editing
        enableBracketEditing();
    }
}

// Disable bracket editing when submitted
function disableBracketEditing() {
    const teamCards = document.querySelectorAll('.team-card');
    teamCards.forEach(card => {
        // Don't disable pointer events - we still want hover to show team info
        card.style.opacity = '1'; // Keep full visibility
        card.style.cursor = 'default'; // Show default cursor instead of pointer
    });

    // Region tabs remain enabled for viewing different regions
    const regionTabs = document.querySelectorAll('.region-tab');
    regionTabs.forEach(tab => {
        tab.disabled = false;
    });
}

// Enable bracket editing
function enableBracketEditing() {
    const teamCards = document.querySelectorAll('.team-card');
    teamCards.forEach(card => {
        card.style.pointerEvents = 'auto';
        card.style.opacity = '1';
    });

    const regionTabs = document.querySelectorAll('.region-tab');
    regionTabs.forEach(tab => {
        tab.disabled = false;
    });
}

// Handle Enter key in ranking input
document.addEventListener('keypress', function(event) {
    if (isModalOpen && event.key === 'Enter') {
        confirmRank();
    }
});

// Setup region tabs
function setupRegionTabs() {
    const tabs = document.querySelectorAll('.region-tab');
    const regions = document.querySelectorAll('.region');
    
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const regionName = tab.dataset.region;
            
            // Remove active class from all tabs and regions
            tabs.forEach(t => t.classList.remove('active'));
            regions.forEach(r => r.classList.remove('active'));
            
            // Add active class to clicked tab and corresponding region
            tab.classList.add('active');
            const activeRegion = document.querySelector(`.region[data-region="${regionName}"]`);
            if (activeRegion) {
                activeRegion.classList.add('active');
                // Render bracket lines for the newly active region
                setTimeout(() => renderActiveBracketLines(), 50);
            }
        });
    });
}

function renderActiveBracketLines() {
    const activeRegion = document.querySelector('.region.active');
    if (!activeRegion) return;
    
    const linesWrapper = activeRegion.querySelector('.bracket-lines');
    if (!linesWrapper) return;
    
    const actualWidth = linesWrapper.offsetWidth;
    if (actualWidth === 0) return;
    
    const rootStyles = getComputedStyle(document.documentElement);
    const rowHeight = parseFloat(rootStyles.getPropertyValue('--bracket-row-height')) || 44;
    
    const svg = buildBracketLines(rowHeight, actualWidth);
    linesWrapper.innerHTML = '';
    linesWrapper.appendChild(svg);
}

// ===== VIEW SWITCHING FUNCTIONALITY =====


// Show confirmation dialog before final submission
function showConfirmationDialog() {
    const confirmed = confirm('Are you sure you want to submit your bracket? You will not be able to make changes after submission.');
    
    if (confirmed) {
        finalizeSubmission();
    }
}

// Finalize bracket submission
function finalizeSubmission() {
    const exportData = {
        timestamp: new Date().toISOString(),
        totalTeamsRanked: Object.keys(rankings).length,
        rankings: Object.entries(rankings)
            .sort((a, b) => b[1] - a[1])
            .map(([teamId, rank]) => {
                const team = ALL_TEAMS.find(t => t.id === parseInt(teamId));
                return {
                    rank,
                    teamName: team.name,
                    seed: team.seed
                };
            })
    };

    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `march-madness-bracket-${Date.now()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    // Mark bracket as submitted
    bracketSubmitted = true;
    localStorage.setItem('marchMadnessBracketSubmitted', 'true');

    // Show success message
    alert('Bracket submitted successfully! Your ranking has been locked in.');
    
    // Update UI
    updateUIBasedOnSubmissionStatus();
}
