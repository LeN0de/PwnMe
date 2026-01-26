// skapar variabel för webbsidan
let AccountSearchTimeout;
let lastQuery = '';
let activeRequest = null;

let enterKeyPressed = false;

// en funktion för att söka användarens användarnamn inom databasen när användaren skriver in minst 2 bokstäver inom användaren att regiera
async function searchUsers(query, isEnterKey = false) {
    // sätter flag om den är från enter key 
    enterKeyPressed = isEnterKey;
    
    // gör queryn till små bokstäver och tar bort alla mellanrum runt om queryn
    query = query.trim().toLowerCase();
    
    // startar om timeout och avbryter sök requests till servern
    clearTimeout(AccountSearchTimeout);
    if (activeRequest) {
        activeRequest.abort();
        activeRequest = null;
    }
    

    // sök inte om query är mindre än 2 bokstäver eller om den är samma som föra sök queryn som användaren har skrivit in 
    if (query.length < 2 || query === lastQuery) {
        hideResults();
        return;
    }
    
    // om enter knappen är tryckt vissa inga resultat 
    if (enterKeyPressed) {
        hideResults();
        return;
    }
    
    // sparar queryn som en senaste queryn
    lastQuery = query;
    
    // använder debounce med delay
    const delay = query.length < 3 ? 500 : 300;
    
    AccountSearchTimeout = setTimeout(async () => {
        // skip om enter knappen var tryckt medans den var i en delay 
        if (enterKeyPressed) {
            enterKeyPressed = false;
            return;
        }
        
        // skriv i html att den söker efter användaren
        const resultsContainer = document.getElementById('searchResultsUser');
        resultsContainer.innerHTML = '<div class="search-loading">Searching...</div>';
        resultsContainer.style.display = 'block';
        
        try {
            // lägger en abortcontroller för att kunna avsluta kopplingen närsomhelst
            const controller = new AbortController();
            activeRequest = controller;
            
            const response = await fetch('/admin/search_users', { // skickar en fetch request till servern med sök queryn 
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ query: query }),
                signal: controller.signal
            });
            
            if (!response.ok) throw new Error('Search failed'); // om den svara inte med status kod 200 så skriver den att någoting gick fel
            
            const data = await response.json();
            
            // endast uppdatera om query hade inte bytt under tiden användaren skickat en request
            if (query === document.getElementById('username_input').value.trim().toLowerCase()) {
                displaySearchResults(data.users);
            }
        } catch (error) {
            if (error.name !== 'AbortError') {
                console.error('Search error:', error);
                resultsContainer.innerHTML = '<div class="search-error">Search failed</div>';
            }
        } finally {
            activeRequest = null;
        }
    }, delay);
}

function displaySearchResults(users) { // en funktion för att visa sök resultatet
    const resultsContainer = document.getElementById('searchResultsUser'); // hämtar elementet genom id
    
    if (!users || users.length === 0) { // om server svarade men inga användaren eller om users variabeln har inte angetts så skriver ut att ingen användare hittades
        resultsContainer.style.display = 'block';
        resultsContainer.style.alignContent = 'center';
        resultsContainer.innerHTML = '<div class="no-users">No users found</div>';
        return;
    }
    
    // skapar en fragment för att skapa element inom sidan
    const fragment = document.createDocumentFragment();
    
    // visar max 8 resultat
    users.slice(0, 8).forEach(user => { // för varenda sök resultat skapa en element där det skriver ut användarenamnen och rolen
        const userElement = document.createElement('div');
        userElement.className = 'search-result-item';
        userElement.innerHTML = `
            <span class="username">${escapeHtml(user.username)}</span> 
            <span class="user-role">${escapeHtml(user.role)}</span>
        `;
        userElement.onclick = () => { // om användaren trycker på en av användaren så autofyllar den sökbaren med valt användarnamnet, gömmer resultatet och får användarens info
            document.getElementById('username_input').value = user.username;
            hideResults();
            get_user_info();
        };
        fragment.appendChild(userElement); // skriver in det som en child i fragment
    });
    
    resultsContainer.innerHTML = ''; // tömmer resultat container och anger den fragment som child och gör den synligt med display block
    resultsContainer.appendChild(fragment);
    resultsContainer.style.display = 'block';
}

function hideResults() { // en funktion för att gömma resultatet
    const resultsContainer = document.getElementById('searchResultsUser');
    resultsContainer.style.display = 'none';
}


document.addEventListener('click', function(e) { // om användaren har tryckt utanför användarnamnen gömmer den resultatet
    if (!e.target.closest('#searchResultsUser') && e.target.id !== 'username_input') {
        hideResults();
    }
});

window.addEventListener("DOMContentLoaded", (event) => { // om användaren har skrivit in användarnamnet och har tryckt enter knappen så söker den användarens info och gömmer resultatet
    document.getElementById("username_input").addEventListener("keydown", function (event) {
        if (event.key === "Enter") {
            event.preventDefault();
            searchUsers(this.value, true);
            hideResults();
            if (this.value.trim().length > 0) {
                get_user_info();
            }
        }
    });
});

async function apply_user_changes() { // en funktionf för att tillämpa användarens ändringar 
    const username = document.getElementById('user_username').innerText;
    const clearUserTime = document.getElementById('clear_user_time').checked.toString();
    const clearUserFlags = document.getElementById('clear_user_flags').checked.toString();
    const logoutUser = document.getElementById('logout_user').checked.toString();
    const account_info_box = document.getElementById('account_info_box');
    const flags_element = document.getElementById('flags_element');
    let username_input = document.getElementById('username_input').value;

    const userRoleSelected = document.getElementById('UserRoleSelected').innerText;

    const userStatusSelected = document.getElementById('UserStatusSelected').innerText;

    account_info_box.innerText = 'Tillämpar ändringar...'; // skriver i infoboxen att ändringarna blir tillämpade
    flags_element.innerText = ''; // tömmer flags_element ifall det har redan skrivits en error från en tidigare kallelse av funktionen

    try { // skickar över requesten

        // skapar request bodyn i json
        data = {username: username, flags: removeUserFlags, role: userRoleSelected, status: userStatusSelected, clearTime: clearUserTime, clearFlags: clearUserFlags, logout: logoutUser}
    
        // skickar en fetch request till backend för att tillämpa ändringarna 
        res = await fetch('/admin/account_edit', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(data), // gör bodyn till en json string
        });
        
        if (res.ok) { // om servern svarade med status kod 200 så skriver den att ut användarens info
            username_input = data.username;
            current_loaded_user = ''
DescriptionLenghtCheck
            get_user_info();
        } else {
            account_info_box.innerText = '';
            flags_element.innerText = await res.text();
        }
            
    } catch (error) {

    }
}