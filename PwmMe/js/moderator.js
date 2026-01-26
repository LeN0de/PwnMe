// skapar variabel för webbsidan
const url = "/moderator/moderator_panel.html"
let page = 1;
let current_loaded_user = '';
let AccountSearchTimeout;
let lastQuery = '';
let activeRequest = null;
let removeUserFlags = []
let enterKeyPressed = false;

// eventlistener för att kunna veta vad att ladda in för användaren genom endast url
document.addEventListener('DOMContentLoaded', function() {
    const page_url = window.location.href; // sparar hela url inom en variabel
    const hashIndex = page_url.indexOf('#'); // räknar antal bokstäver efter #
    
    if (hashIndex > -1 && hashIndex < page_url.length - 1) { // om # finns inte eller om det finns ingenting efter #
        const category = decodeURI(page_url.substring(hashIndex + 1)); // tar texten som finns efter #
        view_box(category); // kallar på funktionen med texten efter #
    }
});


document.addEventListener('DOMContentLoaded', function() { // eventlistener för dropdown boxes
    (function($) {
        var CheckboxDropdown = function(el) {
        var _this = this;
        this.isOpen = false;
        this.areAllChecked = false;
        this.$el = $(el);
        this.$label = this.$el.find('.dropdown-label');
        this.$checkAll = this.$el.find('[data-toggle="check-all"]').first();
        this.$inputs = this.$el.find('[type="checkbox"]');
        
        this.onCheckBox();
        
        this.$label.on('click', function(e) {
            e.preventDefault();
            _this.toggleOpen();
        });
        
        this.$checkAll.on('click', function(e) {
            e.preventDefault();
            _this.onCheckAll();
        });
        
        this.$inputs.on('change', function(e) {
            _this.onCheckBox();
        });
        };
        
        CheckboxDropdown.prototype.onCheckBox = function() {
        this.updateStatus();
        };
        
        CheckboxDropdown.prototype.updateStatus = function() {
        var checked = this.$el.find(':checked');
        
        this.areAllChecked = false;
        this.$checkAll.html('Check All');
        
        if(checked.length <= 0) {
            this.$label.html('Select flags');
        }
        else if(checked.length === 1) {
            this.$label.html(checked.parent('label').text());
        }
        else if(checked.length === this.$inputs.length) {
            this.$label.html('All Selected');
            this.areAllChecked = true;
            this.$checkAll.html('Uncheck All');
        }
        else {
            this.$label.html(checked.length + ' Selected');
        }
        };
        
        CheckboxDropdown.prototype.onCheckAll = function(checkAll) {
        if(!this.areAllChecked || checkAll) {
            this.areAllChecked = true;
            this.$checkAll.html('Uncheck All');
            this.$inputs.prop('checked', true);
        }
        else {
            this.areAllChecked = false;
            this.$checkAll.html('Check All');
            this.$inputs.prop('checked', false);
        }
        
        this.updateStatus();
        };
        
        CheckboxDropdown.prototype.toggleOpen = function(forceOpen) {
        var _this = this;
        
        if(!this.isOpen || forceOpen) {
            this.isOpen = true;
            this.$el.addClass('on');
            $(document).on('click', function(e) {
            if(!$(e.target).closest('[data-control]').length) {
            _this.toggleOpen();
            }
            });
        }
        else {
            this.isOpen = false;
            this.$el.removeClass('on');
            $(document).off('click');
        }
        };
        
        var checkboxesDropdowns = document.querySelectorAll('[data-control="checkbox-dropdown"]');
        for(var i = 0, length = checkboxesDropdowns.length; i < length; i++) {
        new CheckboxDropdown(checkboxesDropdowns[i]);
        }
    })(jQuery);
});

document.addEventListener('DOMContentLoaded', function() { // eventlistener för dropdown status
    const label = document.querySelector('.dropdown_label_status');
    const options = document.querySelectorAll('.dropdown_option_status');
    const dropdown = document.querySelector('.dropdown_status');
    
    if (!label || !options.length || !dropdown) return;
   
    // listener till var man har tryckt inom webbsidan
    label.addEventListener('click', function(e) {
        e.stopPropagation();
        dropdown.classList.toggle('on');
    });
    
    // för att veta vilken av de ska väljas
    options.forEach(option => {
        option.addEventListener('click', function(e) {
            e.stopPropagation();
            
            options.forEach(opt => {
                opt.classList.remove('selected');
            });
            
            this.classList.add('selected');
            
            label.textContent = this.textContent;
            
            dropdown.classList.remove('on');
        });
    });
    
    // stänger dropboxen när man trycker utanför
    document.addEventListener('click', function(e) {
        if (!dropdown.contains(e.target)) {
            dropdown.classList.remove('on');
        }
    });
});

async function view_box(selection) { // funktion för att visa panel
    const box = document.getElementById(selection);

    box.style.display = 'flex';
    location.href = `${url}#${selection}`;
}

async function close_box(selection) { // funktion för att gömma panel
    const box = document.getElementById(selection);

    box.style.display = 'none';
    location.href = url + '#';
}

async function get_user_info() { // function för att få användarens info genom att skicka till servern

    page_countContainer = document.getElementById('page_count-container')
    const account_info_box = document.getElementById('account_info_box');
    const flags_element = document.getElementById('flags_element');

    const username_input = document.getElementById('username_input').value;

    if (username_input.length !== 0 && username_input !== current_loaded_user) {
        document.getElementById('clear_user_flags').checked = false;
        document.getElementById('flags_element').style = "pointer-events: auto";
        removeUserFlags = []

        current_loaded_user = username_input;
        try {
            account_info_box.innerText = 'Loading user info...'
            flags_element.innerText = 'Loading user flags...'

            const data_info = { // skapar datan för användarens info
                username: username_input,
            };

            const res_info = await fetch('/user/get_user_info', { // skickar över datan till servern för att få användarens info
                method: "POST",
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(data_info),
            });

            const data_flag = { // skapar datan för användarens flaggor (max 6 flaggor)
                username: username_input,
                page: page,
                count: 6,
            }

            const res_flags = await fetch('/user/get_user_flags', { // skickar över datan till servern för att få användarens flaggor
                method: "POST",
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(data_flag),
            });

            if (res_info.ok && res_flags.ok) { // kollar om servern svarade med status kod 200 för både request
                response_flags = await res_flags.json();
                response_info = await res_info.json();

                const user_info = JSON.parse(response_info.user_info); // gör använarens info till en json lista

                // skriver användarens info till webbsidan
                account_info_box.innerHTML = `
                <p class="text">username: <span id="user_username">${user_info.username}</span></p>
                <p class="text">role: <span id="user_role">${user_info.role}</span></p>
                <p class="text">status: <span id="user_status">${user_info.account_status}</span></p>
                <p class="text">total points: <span id="user_points">${user_info.total_points}</span></p>
                <p class="text">total flags: <span id="user_flags">${user_info.success_flags}</span></p>
                <p class="text">position: <span id="user_position">${user_info.position}</span></p>
                <p class="text">time completed: <span id="user_completion">${user_info.completion_time}</span></p>
                `

                UserStatusSelected = document.getElementById('UserStatusSelected');

                UserStatusSelected.innerText = user_info.account_status;

                CurrentDropdownSettingStatus = document.getElementsByClassName("dropdown_option_status selected");

                if (!!CurrentDropdownSettingStatus.length) { // kollar om användaren hade redan väljt ett status
                    for (let i = 0; i < CurrentDropdownSettingStatus.length; i++) {
                        CurrentDropdownSettingStatus[i].classList.remove("selected"); // av värljer alla boxes som är redan valt innan man hade sökt efter användarens info
                    }
                }

                const flags = JSON.parse(response_flags.flags); // gör använarens flaggor till en json lista

                const fragment = document.createDocumentFragment(); // skapar en fragment för att lägga till användarens flaggor

                flags.forEach((flags) => {                
                    const row = document.createElement('div');
                    row.className = 'flag-box-account-profile flag-box flag-head box_user_flag'
                    row.id = 'row-flag'
                    row.innerHTML = `
                    <div style="position: absolute;">
                    <input type="checkbox"  style="cursor: pointer;"id="${flags.name}" name="${flags.name}" value="true">
                    </div>
                    <div class="flag-box-account-profile flag-box flag-head info_user_flag" id="row-info">
                    <h1 class="text">${flags.name}</h1>
                    <p class="text">svårighet: <span class="difficulty-${flags.difficulty}">${flags.difficulty}</span></p>
                    <p class="text" <span>poäng: ${flags.points}</span> category: <span class="difficulty-${flags.difficulty} text">${flags.category}</span></p> 
                    </div>
                    `;

                    fragment.appendChild(row);
                });

                flags_element.innerHTML = '';
                flags_element.appendChild(fragment);

                // för att skapa tillgängliga pages för användarens flaggor
                max_pages = 10; // max antal pages att visa
                max_half = Math.floor(max_pages/2);
                let start, end;
        
                page_count = response_flags.pages;
        
                currentpage = parseInt(page) || 1;
        
                    // beräknar antal pages att visa
                if (page_count <= max_pages) {
                    // visa alla pages om det finns inte mycket
                    start = 1;
                    end = page_count;
                } else if (currentpage <= max_half) {
                    // början
                    start = 1;
                    end = max_pages;
                } else if (currentpage >= page_count - max_half) {
                    // slutar
                    start = page_count - max_pages + 1;
                    end = page_count;
                } else {
                    // mellan delen
                    start = currentpage - max_half;
                    end = currentpage + max_half - 1;
                }
        
                    // skapar en list för pages
                const page_list = Array.from({length: end - start + 1}, (_, i) => start + i);

                // skapar fragment för pages
                const fragment_pages = document.createDocumentFragment();
        
                // läggar allt inom ett tr för att lägga till alla pages
                const pages = document.createElement('tr');
                pages.className = "pages_list_align"
        
                page_list.forEach((page_list) => {
        
                    list = document.createElement('td');
                    if (page_list !== currentpage) {
                        list.innerHTML = `<button class="pages" onclick="flags_load('${user_info.username}', ${page_list})">${page_list}</button>`;
                    } else {
                        list.innerHTML = `<button class="pages" style="color: white;">${page_list}</button>`;
                    }
        
                    pages.appendChild(list);
                });
        
                // lägger tillämpar ändringarna till webbsidan
                fragment_pages.appendChild(pages);
                page_countContainer.innerHTML = '';
                page_countContainer.appendChild(fragment_pages);
            } else {
                account_info_box.innerHTML = await res_info.text();
                flags_element.innerHTML = '';
            }
        } catch (error){
            console.error("Oops en error occurred" + error)
        }
    } else {
        return
    }
};

async function flags_load(username, page) { // function för att ladda användarens flaggor genom pages
    page_countContainer = document.getElementById('page_count-container')
    const account_info_box = document.getElementById('account_info_box');
    const flags_element = document.getElementById('flags_element');

    flags_element.innerText = 'Loading flags...'

    try { // skapar datan till servern
        const data_flag = {
            username: username,
            page: page,
            count: 6,
        }

        const res_flags = await fetch('/user/get_user_flags', { // skickar över datan till servern
            method: "POST",
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(data_flag),
        });

        if (res_flags.ok) { // om servern svarade med status kod 200

            response_flags = await res_flags.json();

            const user_info = JSON.parse(response_info.user_info); 

            const flags = JSON.parse(response_flags.flags); // gör användarens flaggor till json list

            const fragment = document.createDocumentFragment(); // skapar fragment
            
            flags.forEach((flags) => { // för varenda flagga inom flags så skapar det ett inom webbsidan
                let checkedflag = '' 
                const row = document.createElement('div');
                if (removeUserFlags.includes(flags.name)) {
                    checkedflag = 'checked';
                }
                row.className = 'flag-box-account-profile flag-box flag-head box_user_flag'
                row.id = 'row-flag'
                row.innerHTML = `
                <div style="position: absolute;">
                <input type="checkbox"  style="cursor: pointer;"id="${flags.name}" name="${flags.name}" value="true" ${checkedflag} />
                </div>
                <div class="flag-box-account-profile flag-box flag-head info_user_flag" id="row-info">
                <h1 class="text">${flags.name}</h1>
                <p class="text">svårighet: <span class="difficulty-${flags.difficulty}">${flags.difficulty}</span></p>
                <p class="text" <span>poäng: ${flags.points}</span> category: <span class="difficulty-${flags.difficulty} text">${flags.category}</span></p> 
                </div>
                `;

                fragment.appendChild(row);
            });

            flags_element.innerHTML = '';
            flags_element.appendChild(fragment);

            // för att skapa tillgängliga pages för användarens flaggor
            max_pages = 10; // max antal pages att visa
            max_half = Math.floor(max_pages/2);
            let start, end;

            page_count = response_flags.pages;

            currentpage = parseInt(page) || 1;

                    // beräknar antal pages att visa
            if (page_count <= max_pages) {
                    // visa alla pages om det finns inte mycket
                start = 1;
                end = page_count;
            } else if (currentpage <= max_half) {
                    // början
                start = 1;
                end = max_pages;
            } else if (currentpage >= page_count - max_half) {
                // slutar
                start = page_count - max_pages + 1;
                end = page_count;
            } else {
                // mellan delen
                start = currentpage - max_half;
                end = currentpage + max_half - 1;
            }

                    // skapar en list för pages
            const page_list = Array.from({length: end - start + 1}, (_, i) => start + i);

            // skapar fragment för pages
            const fragment_pages = document.createDocumentFragment();

            // lägger allt inom ett tr för att lägga alla pages
            const pages = document.createElement('tr');
            pages.className = "pages_list_align"

            page_list.forEach((page_list) => {

                list = document.createElement('td');
                if (page_list !== currentpage) {
                    list.innerHTML = `<button class="pages" onclick="flags_load('${user_info.username}', ${page_list})">${page_list}</button>`;
                } else {
                    list.innerHTML = `<button class="pages" style="color: white;">${page_list}</button>`;
                }

                pages.appendChild(list);
            });

            // tillämpar ändringarna till webbsidan
            fragment_pages.appendChild(pages);
            page_countContainer.innerHTML = '';
            page_countContainer.appendChild(fragment_pages);
        } else {
            account_info_box.innerHTML = await res_flags.text();
            flags_element.innerHTML = '';
        }
    } catch (error){
        console.error("Oops en error occurred" + error)
    }
};

// Enkel HTML-escape för säkerhet
function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

document.addEventListener('DOMContentLoaded', function() { // event listener för checkbox inom användarens flaggor
    // Delegera klickhändelser för flaggrutor
    document.getElementById('flags_element').addEventListener('click', function(e) {
        // Hitta närmaste flaggbox div
        const flagBox = e.target.closest('.box_user_flag');
        if (!flagBox) return;
        
        // Hitta kryssrutan i denna flaggruta
        const checkbox = flagBox.querySelector('input[type="checkbox"]');
        if (!checkbox) return;
        
        // Förhindra dubbelväxling när du klickar direkt på kryssrutan
        if (e.target === checkbox) return;
        
        // Växla tillståndet i kryssrutan
        checkbox.checked = !checkbox.checked;
        if (checkbox.checked) {
            removeUserFlags.push(checkbox.id);
        } else {
            removeUserFlags = removeUserFlags.filter(flag => flag !== checkbox.id);
        }
        
        
        // Utlös ändringshändelse om annan kod lyssnar efter den
        checkbox.dispatchEvent(new Event('change'));
    });
});

document.addEventListener('DOMContentLoaded', function() { // eventlistener för clear_user_flags checkbox 
    // Delegera klickhändelser för flaggrutor
    document.getElementById('clear_user_flags_div').addEventListener('click', function() {
        const checkbox_clear_flags = document.getElementById('clear_user_flags').checked;
        const flags_element = document.getElementById('flags_element'); // får alla flaggor inom webbsidan med id "flag_element"

        if (checkbox_clear_flags) { // kollar om checkboxen är checked
            removeUserFlags.forEach(flags => { // för varenda flagga som är checked så uncheckar den det
                if (document.getElementById(flags)) {
                    document.getElementById(flags).checked = false;
                }
            });
            removeUserFlags = []; // tar bort alla flaggor som admin vill ta bort från användaren
            flags_element.style = "pointer-events: none";
        } else {
            flags_element.style = "pointer-events: auto";
        }
    });
});

// function för att söka användaren
async function searchUsers(query, isEnterKey = false) {
    // Ange flagga om detta är från Enter-tangenten
    enterKeyPressed = isEnterKey;
    
    // Normalisera och trimma fråga
    query = query.trim().toLowerCase();
    
    // Rensa tidigare timeout och avbryt eventuella väntande förfrågningar
    clearTimeout(AccountSearchTimeout);
    if (activeRequest) {
        activeRequest.abort();
        activeRequest = null;
    }
    
    // Sök inte efter mycket korta frågor eller om de är oförändrade
    if (query.length < 2 || query === lastQuery) {
        hideResults();
        return;
    }
    
    // Om Retur trycktes, visa inga resultat
    if (enterKeyPressed) {
        hideResults();
        return;
    }
    
    lastQuery = query;
    
    // Avstudsa med progressiva förseningar
    const delay = query.length < 3 ? 500 : 300;
    
    AccountSearchTimeout = setTimeout(async () => {
        // Hoppa över om Enter trycktes under fördröjning
        if (enterKeyPressed) {
            enterKeyPressed = false;
            return;
        }
        
        const resultsContainer = document.getElementById('searchResultsUser');
        resultsContainer.innerHTML = '<div class="search-loading">Searching...</div>';
        resultsContainer.style.display = 'block';
        
        try {
            const controller = new AbortController();
            activeRequest = controller;
            
            const response = await fetch('/admin/search_users', { // request till servern för användaren med liknande användarnamn
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ query: query }),
                signal: controller.signal
            });
            
            if (!response.ok) throw new Error('Search failed'); // om servern svarar inte med status kod 200
            
            const data = await response.json();
            
            // Uppdatera endast om frågan inte har ändrats under begäran
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

// function för att visa resultatet
function displaySearchResults(users) {
    const resultsContainer = document.getElementById('searchResultsUser');
    
    if (!users || users.length === 0) { // listan "users" är tom så skriver den ut att det kunde inte hitta nån användare
        resultsContainer.style.display = 'block';
        resultsContainer.style.alignContent = 'center';
        resultsContainer.innerHTML = '<div class="no-users">No users found</div>';
        return;
    }
    
    const fragment = document.createDocumentFragment(); // skapar fragment
    
    // Limit to top 8 results for better performance
    users.slice(0, 8).forEach(user => { // för det första 8 användare så skriver den ut användarnamn och role
        const userElement = document.createElement('div');
        userElement.className = 'search-result-item';
        userElement.innerHTML = `
            <span class="username">${escapeHtml(user.username)}</span>
            <span class="user-role">${escapeHtml(user.role)}</span>
        `;
        userElement.onclick = () => { // om användaren hade trykt på en av användarna så kallar den på funktionen att gömma resultatet och får valt användarnamns info
            document.getElementById('username_input').value = user.username;
            hideResults();
            get_user_info();
        };
        fragment.appendChild(userElement);
    });

    // tillämpar html ändringar
    resultsContainer.innerHTML = '';
    resultsContainer.appendChild(fragment);
    resultsContainer.style.display = 'block';
}

function hideResults() { // funktion för att gömma reslutat
    const resultsContainer = document.getElementById('searchResultsUser');
    resultsContainer.style.display = 'none';
}

// Stäng rullgardinsmenyn när du klickar utanför
document.addEventListener('click', function(e) {
    if (!e.target.closest('#searchResultsUser') && e.target.id !== 'username_input') {
        hideResults();
    }
});

// eventlistener för att söka användaren om admin hade tryckt på enter medans de skrev in användarenamnet
window.addEventListener("DOMContentLoaded", (event) => {
    document.getElementById("username_input").addEventListener("keydown", function (event) {
        if (event.key === "Enter") {
            event.preventDefault();
            // Ring sökAnvändare med enterKey-flagga men visar inga resultat
            searchUsers(this.value, true);
            // Dölj omedelbart alla befintliga resultat
            hideResults();
            // Ladda användarinformation om det finns innehåll
            if (this.value.trim().length > 0) {
                get_user_info();
            }
        }
    });
});

async function apply_user_changes() { // funktion för att tillämpa användarens äringar 
    const username = document.getElementById('user_username').innerText;
    const clearUserTime = document.getElementById('clear_user_time').checked.toString();
    const clearUserFlags = document.getElementById('clear_user_flags').checked.toString();
    const logoutUser = document.getElementById('logout_user').checked.toString();
    const account_info_box = document.getElementById('account_info_box');
    const flags_element = document.getElementById('flags_element');
    let username_input = document.getElementById('username_input').value;

    const user_role = document.getElementById('user_role').innerText;

    const userStatusSelected = document.getElementById('UserStatusSelected').innerText;

    account_info_box.innerText = 'Tillämpar ändringar...';
    flags_element.innerText = '';

    try {
        // datan för att skicka över till servern
        data = {username: username, flags: removeUserFlags, role: user_role, status: userStatusSelected, clearTime: clearUserTime, clearFlags: clearUserFlags, logout: logoutUser}
    
        res = await fetch('/admin/account_edit', { // skickar över datans till servern
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(data),
        });
        
        if (res.ok) { // om servern svarar med status kod 200 så uppdaterar den admin panel med användarens nya ändringar
            username_input = data.username;
            current_loaded_user = ''

            get_user_info();
        } else {
            account_info_box.innerText = '';
            flags_element.innerText = await res.text();
        }
            
    } catch (error) {

    }
}