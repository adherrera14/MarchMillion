// Leaderboard Data
let LEADERBOARD_DATA = null;

// Initialize the leaderboard page
document.addEventListener('DOMContentLoaded', async function() {
    // Show loading indicator
    showLoadingIndicator();
    
    // Load leaderboard data
    const dataLoaded = await loadLeaderboardData();
    
    // Hide loading indicator
    hideLoadingIndicator();
    
    if (!dataLoaded) {
        return; // Exit if data failed to load
    }
    
    // Display leaderboard
    loadAndDisplayLeaderboard();
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
            <div style="margin-bottom: 20px;">Loading Leaderboard...</div>
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

// Load leaderboard data
async function loadLeaderboardData() {
    try {
        const response = await fetch('./leaderboard.json');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        LEADERBOARD_DATA = await response.json();
        return true;
    } catch (error) {
        console.error('Error loading leaderboard data:', error);
        showErrorMessage('Failed to load leaderboard data.');
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

// Load and display leaderboard
async function loadAndDisplayLeaderboard() {
    if (!LEADERBOARD_DATA) {
        return;
    }

    displayLeaderboardTable();
    displayGameResults();
    updateTournamentInfo();
}

// Display leaderboard table
function displayLeaderboardTable() {
    const leaderboardBody = document.getElementById('leaderboardBody');
    leaderboardBody.innerHTML = '';

    const standings = LEADERBOARD_DATA.standings || [];
    
    standings.forEach((player, index) => {
        const row = document.createElement('tr');
        
        // Rank
        const rankCell = document.createElement('td');
        rankCell.className = 'leaderboard-rank';
        rankCell.textContent = index + 1;
        row.appendChild(rankCell);
        
        // Player name
        const nameCell = document.createElement('td');
        nameCell.className = 'leaderboard-player-name';
        nameCell.textContent = player.userName;
        row.appendChild(nameCell);
        
        // Total points
        const pointsCell = document.createElement('td');
        pointsCell.className = 'leaderboard-points';
        pointsCell.innerHTML = player.totalPoints + '<div class="leaderboard-progress-bar"><div class="leaderboard-progress-fill" style="width:' + player.progressPercentage + '%"></div></div>';
        row.appendChild(pointsCell);
        
        // Progress percentage
        const progressCell = document.createElement('td');
        progressCell.style.textAlign = 'center';
        progressCell.innerHTML = player.progressPercentage + '%';
        row.appendChild(progressCell);
        
        // Points by round
        const rounds = ['round1', 'round2', 'round3', 'round4', 'round5', 'round6'];
        rounds.forEach(round => {
            const roundCell = document.createElement('td');
            roundCell.className = 'round-points ' + (player.pointsByRound[round] > 0 ? 'completed' : 'pending');
            roundCell.textContent = player.pointsByRound[round] || '-';
            row.appendChild(roundCell);
        });
        
        leaderboardBody.appendChild(row);
    });
}

// Display game results
function displayGameResults() {
    const gameResultsContainer = document.getElementById('gameResultsContainer');
    gameResultsContainer.innerHTML = '';

    if (!LEADERBOARD_DATA.gameResults || LEADERBOARD_DATA.gameResults.length === 0) {
        gameResultsContainer.innerHTML = '<p style="color: #999; text-align: center; padding: 2rem;">No game results yet.</p>';
        return;
    }

    // Get the most recent games (last 8)
    const recentGames = LEADERBOARD_DATA.gameResults.slice(-8);

    recentGames.forEach(game => {
        const gameCard = document.createElement('div');
        gameCard.className = 'game-result-card';
        
        let roundLabel = 'Round ' + game.round;
        if (game.region) {
            roundLabel += ' (' + game.region + ')';
        }
        
        let html = '<div class="game-round">' + roundLabel + '</div>';
        html += '<div class="game-matchup">';
        
        const team1Winner = game.winner === game.team1;
        const team2Winner = game.winner === game.team2;
        
        html += '<div class="game-team ' + (team1Winner ? 'winner' : '') + '">';
        html += '<span class="game-team-name">' + game.team1 + '</span>';
        html += '<span class="game-points">' + game.pointsValue + '</span>';
        html += '</div>';
        
        html += '<div class="game-team ' + (team2Winner ? 'winner' : '') + '">';
        html += '<span class="game-team-name">' + game.team2 + '</span>';
        html += '<span class="game-points">' + game.pointsValue + '</span>';
        html += '</div>';
        
        html += '</div>';
        
        gameCard.innerHTML = html;
        gameResultsContainer.appendChild(gameCard);
    });
}

// Update tournament info
function updateTournamentInfo() {
    if (!LEADERBOARD_DATA.tournament) return;

    const tournament = LEADERBOARD_DATA.tournament;
    const statusEl = document.getElementById('tournamentStatus');
    const updatedEl = document.getElementById('lastUpdated');

    if (statusEl) {
        statusEl.textContent = 'Round ' + tournament.currentRound + ' of ' + tournament.totalRounds + ' - ' + tournament.status.replace('-', ' ').toUpperCase();
    }

    if (updatedEl) {
        const lastUpdated = new Date(tournament.lastUpdated);
        updatedEl.textContent = 'Last updated: ' + lastUpdated.toLocaleString();
    }
}
