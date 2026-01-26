let FlagSearchTimeout;
let FlagsLastQuery = '';
let FlagsActiveRequest = null;

let previousDifficultyFlag;
let enterKeyFlagPressed = false;

// function för att söka flaggor
async function SearchFlags(query, isEnterKey = false) {
    // Ange flagga om detta är från Enter-tangenten
    enterKeyFlagPressed = isEnterKey;
    
    // Normalisera och trimma fråga
    query = query.trim().toLowerCase();
    
    // Sök inte efter mycket korta frågor eller om de är oförändrade
    clearTimeout(FlagSearchTimeout);
    if (FlagsActiveRequest) {
        FlagsActiveRequest.abort();
        FlagsActiveRequest = null;
    }
    
    // Om enter trycktes, visa inga resultat
    if (query.length < 2 || query === FlagsLastQuery) {
        hideFlagResults();
        return;
    }
    
    // Avstudsa med progressiva förseningar
    if (enterKeyFlagPressed) {
        hideFlagResults();
        return;
    }
    
    FlagsLastQuery = query;
    
    // Avstudsa med progressiva förseningar
    const delay = query.length < 3 ? 500 : 300;
    
    FlagSearchTimeout = setTimeout(async () => {
        // Hoppa över om Enter trycktes under fördröjning
        if (enterKeyFlagPressed) {
            enterKeyFlagPressed = false;
            return;
        }
        
        const resultsContainer = document.getElementById('searchResultsFlag');
        resultsContainer.innerHTML = '<div class="search-loading">Searching...</div>';
        resultsContainer.style.display = 'block';
        
        try {
            const controller = new AbortController();
            FlagsActiveRequest = controller;
            
            const response = await fetch('/admin/search_flags', { // request till servern för användaren med liknande användarnamn
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ query: query }),
                signal: controller.signal
            });
            
            if (!response.ok) throw new Error('Search failed'); // om servern svarar inte med status kod 200
            
            const data = await response.json();
            
            // Uppdatera endast om frågan inte har ändrats under begäran
            if (query === document.getElementById('flag_input').value.trim().toLowerCase()) {
                displayFlagsSearchResults(data.flags);
            }
        } catch (error) {
            if (error.name !== 'AbortError') {
                console.error('Search error:', error);
                resultsContainer.innerHTML = '<div class="search-error">Search failed</div>';
            }
        } finally {
            FlagsActiveRequest = null;
        }
    }, delay);
}

// function för att visa resultatet
function displayFlagsSearchResults(flags) {
    const resultsContainer = document.getElementById('searchResultsFlag');
    
    if (!flags || flags.length === 0) { // listan "flags" är tom så skriver den ut att det kunde inte hitta nån användare
        resultsContainer.style.display = 'block';
        resultsContainer.style.alignContent = 'center';
        resultsContainer.innerHTML = '<div class="no-users">No flags found</div>';
        return;
    }
    
    const fragment = document.createDocumentFragment(); // skapar fragment
    
    // Limit to top 8 results for better performance
    flags.slice(0, 8).forEach(flags => { // för det första 8 flaggor så skriver den ut namnet
        const flagElement = document.createElement('div');
        flagElement.className = 'search-result-item';
        flagElement.innerHTML = `
            <span class="username">${escapeHtml(flags.name)}</span>
            <span class="user-role">${escapeHtml(flags.category)}</span>
        `;
        flagElement.onclick = () => { // om användaren hade trykt på en av flaggorna så kallar den på funktionen att gömma resultatet och får valt flaggans info
            document.getElementById('flag_input').value = flags.name;
            hideFlagResults();
            get_flag_info();
        };
        fragment.appendChild(flagElement);
    });
    
    // tillämpar html ändringar
    resultsContainer.innerHTML = '';
    resultsContainer.appendChild(fragment);
    resultsContainer.style.display = 'block';
}

function hideFlagResults() { // funktion för att gömma reslutat
    const resultsContainer = document.getElementById('searchResultsFlag');
    resultsContainer.style.display = 'none';
}


// Stäng rullgardinsmenyn när du klickar utanför
document.addEventListener('click', function(e) {
    if (!e.target.closest('#searchResultsFlag') && e.target.id !== 'flag_input') {
        hideFlagResults();
    }
});




async function searchEditCategories(query, isEnterKey = false) { // funktion för att söka kategori
    // Ange flagga om detta är från Enter-tangenten
    CategoryEnterKeyPressed = isEnterKey;
    
    // Normalisera och trimma fråga
    query = query.trim().toLowerCase();
    
    // Rensa tidigare timeout och avbryt eventuella väntande förfrågningar
    clearTimeout(CategorySearchTimeout);
    if (CategoryActiveRequest) {
        CategoryActiveRequest.abort();
        CategoryActiveRequest = null;
    }
    
    // Sök inte efter mycket korta frågor eller om de är oförändrade
    if (query.length < 2 || query === CategoryLastQuery) {
        hideResultsCreateFlag();
        return;
    }
    
    // Om enter trycktes, visa inga resultat
    if (CategoryEnterKeyPressed) {
        hideResultsCreateFlag();
        return;
    }
    
    CategoryLastQuery = query;
    
    // Avstudsa med progressiva förseningar
    const delay = query.length < 3 ? 500 : 300;
    
    CategorySearchTimeout = setTimeout(async () => {
        // Hoppa över om Enter trycktes under fördröjningen
        if (CategoryEnterKeyPressed) {
            CategoryEnterKeyPressed = false;
            return;
        }
        
        // skriv i html att den söker efter kategorin
        const resultsContainer = document.getElementById('searchResultsEditCategory');
        resultsContainer.innerHTML = '<div class="search-loading">Searching...</div>';
        resultsContainer.style.display = 'block';
        
        try {
             // lägger en abortcontroller för att kunna avsluta kopplingen närsomhelst
            const controller = new AbortController();
            CategoryActiveRequest = controller;
            
            const response = await fetch('/admin/search_categories', { // skickar en fetch request till servern med sök queryn 
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ query: query }),
                signal: controller.signal
            });
            
            if (!response.ok) throw new Error('Search failed');  // om den svara inte med status kod 200 så skriver den att någoting gick fel
            
            const data = await response.json();
            
            // Uppdatera endast om frågan inte har ändrats under begäran
            if (query === document.getElementById('flag_category').value.trim().toLowerCase()) {
                console.log(data.category);
                displaysearchResultsEditCategory(data.category);
            }
        } catch (error) {
            if (error.name !== 'AbortError') {
                console.error('Search error:', error);
                resultsContainer.innerHTML = '<div class="search-error">Search failed</div>';
            }
        } finally {
            CategoryActiveRequest = null;
        }
    }, delay);
}

function displaysearchResultsEditCategory(data) { // en funktion för att visa sök resultatet
    const resultsContainer = document.getElementById('searchResultsEditCategory'); // hämtar elementet genom id
    
    if (!data || data.length === 0) { // om server svarade men inga kategorier eller om data variabeln har inte angetts så skriver ut att ingen kategori hittades
        resultsContainer.style.display = 'block';
        resultsContainer.style.alignContent = 'center';
        resultsContainer.innerHTML = '<div class="no-users">Ingen kategori hittas</div>';
        return;
    }
    // skapar en fragment för att skapa element inom sidan
    const fragment = document.createDocumentFragment();
    
    // Begränsa till topp 8 resultat för bättre prestanda
    data.slice(0, 8).forEach(data => {  // för varenda sök resultat skapa en element där det skriver ut kategori
        const categoryElement = document.createElement('div');
        categoryElement.className = 'search-result-item';
        categoryElement.innerHTML = `
            <span class="username">${escapeHtml(data.category)}</span>
        `;
        categoryElement.onclick = () => { // om användaren trycker på en av kategorier så autofyllar den sökbaren med valt kategorin så gömmer den resultatet
            document.getElementById('flag_category').value = data.category;
            hideResultsEditCategory();
        };
        fragment.appendChild(categoryElement); // skriver in det som en child i fragment
    });
    
    // tömmer resultat container och anger den fragment som child och gör den synligt med display block
    resultsContainer.innerHTML = '';
    resultsContainer.appendChild(fragment);
    resultsContainer.style.display = 'block';
}

function hideResultsEditCategory() { // en funktion för att gömma resultatet
    const resultsContainer = document.getElementById('searchResultsEditCategory');
    resultsContainer.style.display = 'none';
}

// om användaren har tryckt utanför kategorin gömmer den resultatet
document.addEventListener('click', function(e) {
    if (!e.target.closest('#searchResultsEditCategory') && e.target.id !== 'flag_category') {
        hideResultsEditCategory();
    }
});


window.addEventListener("DOMContentLoaded", (event) => {
    document.getElementById("flag_category").addEventListener("keydown", function (event) {
        if (event.key === "Enter") {
            event.preventDefault();
            searchEditCategories(this.value, true);
            hideResultsEditCategory();
        }
    });
});

// om användaren har skrivit in kategorin och har tryckt enter knappen så söker den kategorin info och gömmer resultatet
window.addEventListener("DOMContentLoaded", (event) => {
    document.getElementById("flag_input").addEventListener("keydown", function (event) {
        if (event.key === "Enter") {
            event.preventDefault();
            SearchFlags(this.value, true);
            hideFlagResults();
            if (this.value.trim().length > 0) {
                get_flag_info();
            }
        }
    });
});

// gömmer flaggans info
function hide_flag_info(){
    document.getElementById('flag_name').value = '';
    document.getElementById('flag_url').value = '';
    document.getElementById('flag_category').value = '';
    document.getElementById('flag_points').value = '';
    document.getElementById('flag_description').value = '';
    document.getElementById('flag_edit_difficulty').innerHTML = '';
    document.getElementById('flag').innerHTML = '';
    document.getElementById('flag_created').innerHTML = '';
    document.getElementById('flag_updated').innerHTML = '';
}

// function för att få flaggans info
async function get_flag_info(){
    const flag_infotext = document.getElementById('flag_infotext')
    const flag_input = document.getElementById('flag_input').value;
    const flag_name = document.getElementById('flag_name');
    const flag = document.getElementById('flag');
    const flag_url = document.getElementById('flag_url');
    const flag_category = document.getElementById('flag_category');
    const flag_edit_difficulty = document.getElementById('flag_edit_difficulty');
    const flag_points = document.getElementById('flag_points');
    const flag_description = document.getElementById('flag_description');
    const flag_created = document.getElementById('flag_created');
    const flag_updated = document.getElementById('flag_updated');

    hide_flag_info(); // gömmer flaggans info

    flag_infotext.textContent = "Loading..."

    try {
        const res = await fetch('/admin/get_flag_info', { // skickar request till servern för flaggans info
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({flag: flag_input})
        });

        if (res.ok) { // om servern svarar med status kod 200

            const flag_req = await res.json(); // sparar body inom request (json)
            
            info = flag_req.data;

            flag_edit_difficulty_selected = document.querySelector(`[data-value="${info.difficulty}"]`);
            flag_edit_difficulty_selected.classList.add("selected");

            if (previousDifficultyFlag) {
                document.querySelector(`[data-value="${previousDifficultyFlag}"]`).classList.remove("selected");
            }
            previousDifficultyFlag = info.difficulty

            // tillämpar ändringar till admin panel beroende på flag infp

            flag_infotext.innerHTML = '';
            flag_name.value = info.name;
            flag.innerHTML = `${info.flag}`;
            flag_url.value = info.url;
            flag_category.value = info.category;
            flag_edit_difficulty.innerHTML = info.difficulty;
            flag_points.value = info.points;
            flag_description.value = info.description;
            flag_created.innerHTML = `Skapad: ${info.created_at}`;
            flag_updated.innerHTML = `Sist updaterade: ${info.updated_at}`;
        } else {
            flag_infotext.innerHTML = await res.text();
        }
    } catch (error) {
        console.error("Oops en error occurred: " + error)
    }
}