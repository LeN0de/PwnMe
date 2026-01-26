let CategorySearchTimeout;
let CategoryLastQuery = '';
let CategoryActiveRequest = null;

let CategoryEnterKeyPressed = false;

flag_name_create = document.getElementById('flag_name_create');
flag_category_create = document.getElementById('flag_category_create');

async function searchCategories(query, isEnterKey = false) { // funktion för att söka kategori
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
        const resultsContainer = document.getElementById('searchResultsCategory');
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
            
            if (!response.ok) throw new Error('Search failed'); // om den svara inte med status kod 200 så skriver den att någoting gick fel
            
            const data = await response.json();
            
            // Uppdatera endast om frågan inte har ändrats under begäran
            if (query === document.getElementById('flag_category_create').value.trim().toLowerCase()) {
                console.log(data.category);
                displaySearchResultsCategory(data.category);
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

function displaySearchResultsCategory(data) { // en funktion för att visa sök resultatet
    const resultsContainer = document.getElementById('searchResultsCategory'); // hämtar elementet genom id
    
    if (!data || data.length === 0) { // om server svarade men inga kategorier eller om data variabeln har inte angetts så skriver ut att ingen kategori hittades
        resultsContainer.style.display = 'block';
        resultsContainer.style.alignContent = 'center';
        resultsContainer.innerHTML = '<div class="no-users">Ingen kategori hittas</div>';
        return;
    }

    // skapar en fragment för att skapa element inom sidan
    const fragment = document.createDocumentFragment();
    
    // Begränsa till topp 8 resultat för bättre prestanda
    data.slice(0, 8).forEach(data => { // för varenda sök resultat skapa en element där det skriver ut kategori
        const categoryElement = document.createElement('div');
        categoryElement.className = 'search-result-item';
        categoryElement.innerHTML = `
            <span class="username">${escapeHtml(data.category)}</span>
        `;
        categoryElement.onclick = () => { // om användaren trycker på en av kategorier så autofyllar den sökbaren med valt kategorin så gömmer den resultatet
            document.getElementById('flag_category_create').value = data.category;
            hideResultsCreateFlag();
        };
        fragment.appendChild(categoryElement); // skriver in det som en child i fragment
    });
    
    resultsContainer.innerHTML = ''; // tömmer resultat container och anger den fragment som child och gör den synligt med display block
    resultsContainer.appendChild(fragment);
    resultsContainer.style.display = 'block';
}

function hideResultsCreateFlag() { // en funktion för att gömma resultatet
    const resultsContainer = document.getElementById('searchResultsCategory');
    resultsContainer.style.display = 'none';
}

document.addEventListener('click', function(e) { // om användaren har tryckt utanför kategorin gömmer den resultatet
    if (!e.target.closest('#searchResultsCategory') && e.target.id !== 'flag_category_create') {
        hideResultsCreateFlag();
    }
});

window.addEventListener("DOMContentLoaded", (event) => { // om användaren har skrivit in kategorin och har tryckt enter knappen så söker den kategorin info och gömmer resultatet
    document.getElementById("flag_category_create").addEventListener("keydown", function (event) {
        if (event.key === "Enter") {
            event.preventDefault();
            searchCategories(this.value);
            hideResultsCreateFlag();
            if (this.value.trim().length > 0) {
                get_user_info();
            }
        }
    });
});


// kollar ifall det finns redan en flagga med samma kategori och namn
const FlagChecker = {
    timer: null,
    activeRequest: null,
    lastCheck: { name: '', category: '' },

    init() {
        this.nameInput = document.getElementById('flag_name_create');
        this.categoryInput = document.getElementById('flag_category_create');
        this.infoText = document.getElementById('created_flag_infotext');
        this.submitBtn = document.getElementById('submit_create_flag');
        
        if (!this.nameInput || !this.categoryInput) return;
        
        document.addEventListener('input', (e) => {
        if (e.target === this.nameInput || e.target === this.categoryInput) {
            this.scheduleCheck();
        }
        }, { passive: true });
    },

    scheduleCheck() {
        clearTimeout(this.timer);
        if (this.activeRequest) {
        this.activeRequest.abort();
        this.activeRequest = null;
        }
        
        this.timer = setTimeout(() => {
        const currentName = this.nameInput.value.trim();
        const currentCategory = this.categoryInput.value.trim();
        
        // Kontrollera bara om båda har värden och värden har ändrats
        if (currentName && currentCategory && 
            (currentName !== this.lastCheck.name || 
                currentCategory !== this.lastCheck.category)) {
            this.lastCheck = { name: currentName, category: currentCategory };
            this.checkFlag(currentName, currentCategory);
        }
        }, 1000);
    },

    async checkFlag(name, category) {
        try {
        this.infoText.textContent = "Kollar...";
        this.submitBtn.disabled = true;
        
        const controller = new AbortController();
        this.activeRequest = controller;
        
        const response = await fetch('/admin/flag_exist_check', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ queryName: name, queryCategory: category }),
            signal: controller.signal
        });
        
        if (!response.ok) throw new Error(await response.text());
        
        const { exists } = await response.json();
        this.updateUI(exists);
        
        } catch (error) {
        if (error.name !== 'AbortError') {
            this.infoText.textContent = error.message || "Ett fel uppstod";
            console.error("Flag check error:", error);
        }
        } finally {
        this.activeRequest = null;
        }
    },

    updateUI(exists) {
        this.infoText.textContent = exists || "Flaggan är tillgänglig";
        this.submitBtn.disabled = !!exists;
        if (exists) {
            this.submitBtn.className = "button-disabled";
            this.submitBtn.style.cursor = "default";
        } else {
            this.submitBtn.className = "btn";
            this.submitBtn.style.cursor = "pointer";
        }

    }
};

document.addEventListener("DOMContentLoaded", () => FlagChecker.init());

async function create_flag() { // funktion för att skapa flagga
    const flag_info_box = document.getElementById('flag-grid-create-flag');
    const created_flag = document.getElementById('created_flag');
    
    infoText = document.getElementById('created_flag_infotext');

    const name = document.getElementById('flag_name_create').value;
    const url = document.getElementById('flag_url_create').value;
    const category = document.getElementById('flag_category_create').value;
    const difficulty = document.getElementById('flag_difficulty').innerText;
    const points = parseInt(document.getElementById('flag_points_create').value);
    const description = document.getElementById('flag_description_create').value;

    flag_info_box.style.display = 'none';
    
    try {
        const data = { // skapar data att skicka till server
            name: name, 
            url: url, 
            category: category, 
            difficulty: difficulty, 
            points: points, 
            description: description
        };

        infoText.innerText = "Skapar...";

        const res = await fetch ('/admin/create_flag', { // skicka över datan till server
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(data)
        }); 

        if (res.ok) { // om servern svarar med status kod 200 så visar den elementet flag_info_box och skriver ut flaggans kod
            response = await res.json();
            infoText.innerText = "Flaggan skapat";
            flag_info_box.style.display = 'flex';
            created_flag.innerText = response.flag;
        } else {
            infoText.innerText = await res.text();
        }
    } catch (error) {
        infoText.innerText = error;
    }
}