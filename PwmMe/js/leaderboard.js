// Vänta tills DOM är helt laddat
document.addEventListener('DOMContentLoaded', () => {
    const searchParams = new URLSearchParams(window.location.search);

    const page = searchParams.get('page');
    // Skaffa eller skapa behållaren
    let leaderboardContainer = document.getElementById('leaderboard-container');
    let page_countContainer = document.getElementById('page_count-container')
    
    if (!leaderboardContainer) {
        // Skapa behållare om den inte finns
        leaderboardContainer = document.createElement('div');
        leaderboardContainer.id = 'leaderboard-container';
        leaderboardContainer.className = 'leaderboard';
        document.body.appendChild(leaderboardContainer);
    }

    // Lagra tidigare data för att jämföra för ändringar
    let previousUsers = [];
    let previousPages = [];

    // Initiera EventSource-anslutning
    const eventSource = new EventSource(`/leaderboard/stream?page=${page}`);

    eventSource.onmessage = (e) => {
        try {
        const { users, page_count } = JSON.parse(e.data);
        if (JSON.stringify(users) !== JSON.stringify(previousUsers)) {
            updateLeaderboardDOM(users);
            previousUsers = users;
        }
        if (JSON.stringify(page_count) !== JSON.stringify(previousPages)) {
            updatePagesDOM(page_count);
            previousPages = page_count;
        }
        
        } catch (error) {
            console.error('Error parsing leaderboard data:', error);
        }
    };
    eventSource.onerror = (e) => {
        console.error('Leaderboard connection error:', e);
        // Eventuellt implementera återanslutningslogik här
    };

    leaderboardContainer.textContent = 'Loading leaderboard...';

    function updatePagesDOM(page_count) {
        if (!page_countContainer.children.length || page_countContainer.children.length !== page_count) {
            rebuildPages(page_count);
            return;
        }
    }
    
    function updateLeaderboardDOM(users) {
        // Rensa laddningsmeddelande om det finns
        if (leaderboardContainer.textContent === 'Loading leaderboard...') {
            leaderboardContainer.innerHTML = '';
        }
        
        // Om behållaren är tom eller användarantalet ändrat, bygg om helt
        if (!leaderboardContainer.children.length || 
            leaderboardContainer.children.length !== users.length) {
            rebuildLeaderboard(users);
            return;
        }

        // Annars uppdaterar du befintliga rader
        users.forEach((user) => {
            const row = leaderboardContainer.children[user.position];
            if (!row) return;

            // Uppdatera position om ändrad
            const positionElement = row.querySelector('.position');
            if (positionElement && positionElement.textContent !== user.position) {
                positionElement.textContent = user.position;
            }

            // Uppdatera användarnamn om det ändras
            const usernameElement = row.querySelector('.username');
            if (usernameElement && usernameElement.textContent !== user.username) {
                usernameElement.textContent = user.username;
            }

            // Uppdatera poängen om den ändras
            const scoreElement = row.querySelector('.score');
            if (scoreElement && scoreElement.textContent !== user.total_points.toString()) {
                scoreElement.textContent = user.total_points;
            }

            // Uppdatera flaggor om ändrade (endast om flaggelement finns)
            const flagsElement = row.querySelector('.flags');
            if (flagsElement) {
                const flags = JSON.parse(user.success_flags);
                const user_flags = flags.join(", ");
                if (flagsElement.textContent !== user_flags) {
                    flagsElement.textContent = user_flags;
                }
            }

            // Uppdatera tid om ändrad
            const timeElement = row.querySelector('.time');
            if (timeElement) {
                const newTime = user.completion_time || '';
                if (timeElement.textContent !== newTime) {
                    timeElement.textContent = newTime;
                }
            }
        });
    }

    function rebuildPages(page_count){
        max_pages = 10;
        max_half = Math.floor(max_pages/2);
        let start, end;

        currentpage = parseInt(page) || 1;

        // Beräkna antalet sidor som ska visas
        if (page_count <= max_pages) {
            // Visa alla sidor om det inte är många
            start = 1;
            end = page_count;
        } else if (currentpage <= max_half) {
            // början
            start = 1;
            end = max_pages;
        } else if (currentpage >= page_count - max_half) {
            // slutet
            start = page_count - max_pages + 1;
            end = page_count;
        } else {
            // mellan delen
            start = currentpage - max_half;
            end = currentpage + max_half - 1;
        }

            // Skapa lista
        const page_list = Array.from({length: end - start + 1}, (_, i) => start + i);


        // skapar fragment
        const fragment_pages = document.createDocumentFragment();

        // lägger allt inom ett tr för att lägga alla pages
        const pages = document.createElement('tr');
        pages.className = "pages_list_align"

        page_list.forEach((page_list) => {

            list = document.createElement('td');
            if (page_list !== currentpage) {
                list.innerHTML = `<a class="pages" href="/leaderboard.html?page=${page_list}">${page_list}</a>`;
            } else {
                list.innerHTML = `<a class="pages" style="color: white;" href="/leaderboard.html?page=${page_list}">${page_list}</a>`;
            }

            pages.appendChild(list);
        });

        // tillämpar ändringarna till webbsidan
        fragment_pages.appendChild(pages);
        page_countContainer.appendChild(fragment_pages);
    }

    // function för att bygga hela leaderboard
    function rebuildLeaderboard(users) {
        const fragment = document.createDocumentFragment(); // skapa fragment
        
        const row = document.createElement('div'); // skapar en div
        row.className = 'leaderboard-row'; // leaderboard beskrivning
        row.innerHTML = `
        <span class="align position">Plats</span>
        <span class="align username">Användarnamn</span>
        <span class="align score">Poäng</span>
        <span class="align flags">Utmaningar klarat</span>
        <span class="align time">Tid</span>
        `;

        // lägger allting inom fragment
        fragment.appendChild(row);

        
        
        // för varenda användare inom listan "user"
        users.forEach((user) => {
            const flags = JSON.parse(user.success_flags); // tar emot deras flaggor
            const user_flags = flags.slice(0, 2).join(", "); // visar alla möjliga flaggor (max 2)

            const row = document.createElement('div'); // lägger användaren inom ett div
            row.className = 'leaderboard-row'; // anger klass
            row.dataset.username = user.username;
            if (flags.length > 2) { // ifall de har mer än 2 flaggor
                more = "..."
            } else {
                more = ""
            }
            // användaren info
            row.innerHTML = `
                <span class="align position">${user.position}</span>
                <span class="align username" ><a class="accountbtn" href="/account.html?user=${user.username}">${user.username}</a></span>
                <span class="align score">${user.total_points}</span>
                <span class="align flags">${user_flags + more}</span>
                <span class="align time">${user.completion_time || ''}</span>
            `;
            
            // lägger till inom fragment som en child
            fragment.appendChild(row);
        });
        
        // tillämpar ändringar
        leaderboardContainer.innerHTML = '';
        leaderboardContainer.appendChild(fragment);
    }

    // Hantera fönsterstorlek för responsiva justeringar
    window.addEventListener('resize', () => {
        if (previousUsers.length > 0) {
            rebuildLeaderboard(previousUsers);
        }
    });
});