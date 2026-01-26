async function flags_load(user, page) { // function för att ladda användarens flaggor
    try{
        const flags_element = document.getElementById('flags');
        const page_countContainer = document.getElementById('page_count-container')


        flags_element.textContent = 'Loading flags...';
        const data = { // skapar datan för användarens flaggor (max 12 flaggor)
            username: user,
            page: page,
            count: 12
        };

        const res = await fetch('/user/get_user_flags', { // skickar över datan till servern
            method: "POST",
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(data),
        });

        if (res.ok) {  // om servern svarar med status kod 200
            response = await res.json() 

            const flags = JSON.parse(response.flags); // gör flaggorna till en json object

            const fragment = document.createDocumentFragment(); // skapar fragment

            flags.forEach((flags) => { // för varenda flagga inom json objektet så skapar det ett element för webbsidan och lägger det som en child inom fragment
                const row = document.createElement('div')
                row.className = 'flag-box-account-profile flag-box flag-head';
                row.style = 'gap: 0px; justify-content: center;'
                row.innerHTML = `
                <h1 class="text">${flags.name}</h1>
                <p class="text">svårighet: <span class="difficulty-${flags.difficulty}">${flags.difficulty}</span></p>
                <p class="text" <span>poäng: ${flags.points}</span> category: <span class="difficulty-${flags.difficulty} text">${flags.category}</span></p> 
                `;

                fragment.appendChild(row);
            });

            // tillämpar ändringar till webbsidan
            flags_element.innerHTML = '';
            flags_element.appendChild(fragment);
        } else {
            flags.innerHTML = `${res.status}: ${await res.text()}`;
        }

        // för att skapa tillgängliga pages för användarens flaggor
        max_pages = 10; // max antal pages att visa
        max_half = Math.floor(max_pages/2);
        let start, end;

        page_count = response.pages;

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
            // slutet
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
                list.innerHTML = `<button class="pages" onclick="flags_load('${user}', '${page_list.toString()}')">${page_list}</button>`;
            } else {
                list.innerHTML = `<button class="pages" style="color: white;">${page_list}</button>`;
            }

            pages.appendChild(list);
        });

        // lägger tillämpar ändringarna till webbsidan
        fragment_pages.appendChild(pages);
        page_countContainer.innerHTML = '';
        page_countContainer.appendChild(fragment_pages);
    } catch (error) {
        console.error("Oops an error occurred: " + error.message)
    }

}

// början och hastighet för rgb
let step = 0;

function rgbCycle() { // function för rgb färger till text inom webbsidan
    // beräknar rgb värden baserat på step
    const r = Math.floor(Math.sin(step) * 127 + 128);
    const g = Math.floor(Math.sin(step + 2) * 127 + 128);
    const b = Math.floor(Math.floor(Math.sin(step + 4) * 127 + 128));
    
    // tillämpar färgerna till user_role
    user_role.style.color = `rgb(${r}, ${g}, ${b})`;

    step += 0.01; // byter färg med rgb värde 0.01
    requestAnimationFrame(rgbCycle); // kör functionen requestAnimationFrame för att animera ändringen
}

document.addEventListener('DOMContentLoaded', () => { // eventlistener för när webbsidan hade laddats
    const searchParams = new URLSearchParams(window.location.search);
    const user = (searchParams.get('user') || 'CurrentUserProfile'); // letar efter parameter user inom url annars blir det "CurrentUserProfile" 
    const page = searchParams.get('page'); // letar efter page paramter inom url

    const username_element = document.getElementById('username');
    const user_role = document.getElementById('user_role');
    const flags_completed = document.getElementById('flags_completed');
    const leaderboard_position = document.getElementById('leaderboard_position');
    const total_points = document.getElementById('total_points');
    const time_completion_element = document.getElementById('time_completion_element');
    const account_status = document.getElementById('account_status_profile');
    const time_completion = document.getElementById('time_completion');

    // funktion till att ladda användarens profik
    async function user_profile_load(username) {
        try { 
            const main_profile = document.getElementById('main_page');
            // skapar datan till servern
            const data = {
                username: username,
            };

            // skickar över datan till servern
            const res = await fetch('/user/get_user_info', {
                method: "POST",
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(data),
            });

            if (res.ok) { // om servern svarar med status kod 200
                response = await res.json();
                
                const user_profile = JSON.parse(response.user_info); // gör användarens info till json object

                if (user_profile.completion_time !== null) { // om användaren har tiden de har klarat alla flaggorna så anger det elementet time_completion_element display: flex och värdet av användaren tid
                    time_completion_element.style.display = "flex";
                    time_completion.innerHTML = user_profile.completion_time;
                }

                flags_completed.innerHTML = user_profile.success_flags;
                total_points.innerHTML = user_profile.total_points;
                leaderboard_position.innerHTML = user_profile.position;

                if (user_profile.account_status !== "false") { // om användarens status är inte false så skriver den ut statusen och byter färgen
                    account_status.style.display = "inline";
                    account_status.innerHTML = user_profile.account_status;
                    account_status.classList = `${user_profile.account_status}-color`
                }
                username_element.innerHTML = user_profile.username;

                if (user_profile.role === "admin") { // om användarens role är admin så kör den funktionen rgbCycle och skriver "ADMIN👑" som role
                    user_role.innerHTML = "ADMIN👑";
                    rgbCycle()
                } else { // annars byter anpassar den färgen beroende på role och skriver ut deras role
                    user_role.innerHTML = user_profile.role;
                    user_role.classList.add(`${user_profile.role}-color`)
                }

            } else {
                main_profile.innerHTML = `${res.status}: ${await res.text()}`
            }

        } catch (error) {
            console.error("Oops an error occurred: " + error.message)
        }
    }

    // kör funktionen för att ladda in användarens profil
    user_profile_load(user)

    if (user === null && page === null) {
        flags_load("CurrentUserProfile", 1)
    } else if (page === null) {
        flags_load(user, 1);
    } else {
        flags_load(user, page)
    }
});