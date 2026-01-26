const searchParams = new URLSearchParams(window.location.search); // får alla params inom url
const page = searchParams.get('page'); // får page params värde
let page_param = ''; // skapar en tom variabel

regex = /[^0-9]/; // regex för att filtrera mot allt som är inte en nummer

if (!regex.test(page)) { // om det finns endast nummer inom page param i url så lägger den till i variabeln page_param
    page_param = `?page=${parseInt(page)}`;
}

const url = `/hacking.html${page_param}`; // lägger ihop url variabeln med page_param 

async function flag_answear(flag_submit) { // funktion för att skicka svaret till en flagga
    try {
        // tar emot elementen för flaggan med variabeln flag_submit
        const flag_answear = document.getElementById(`${flag_submit}_flag`).value;

        // skapar datan för flaggan
        const data = {
            name: flag_submit,
            flag: flag_answear,
        };
        
        // skickar svaret till servern
        const res = await fetch('/submit', {
            method: "POST",
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(data),
        });


        if (res.ok) { // väntar för svaret. om det är status kod 200 så är svarat rätt
            return window.location.reload(); // för att uppdatera sidan krävs det at ladda om det. Ganska lat sätt att uppdatera
        } else {
            document.getElementById(`flag_answear_${flag_submit}_info`).innerText = await res.text(); // annars ladda in vad webbsidan hade svarat med
        }
    } catch (error) {
        document.getElementById(`website_message`).innerText = "Oops an error occurred: " + error.message;
    }
}

document.addEventListener('DOMContentLoaded', function() { // en eventlistener för att kolla om det finns något hashtag inom url för att veta vilken kategori att ladda in från url
    const page_url = window.location.href; // tar emot hela url
    const hashIndex = page_url.indexOf('#'); // tar allting som finns efter #
    
    // om det finns ingen # i url och är inte den sista bokstaven i url så kallar den funktionen view_category_detail med värdet av vad som finns efter #
    if (hashIndex > -1 && hashIndex < page_url.length - 1) {
        const category = decodeURI(page_url.substring(hashIndex + 1));
        view_category_detail(category);
    }
});

function rebuildPages(page_count){ // för att skapa tillgängliga pages för kategorier
    const page_countContainer = document.getElementById('page_count-container'); 
    max_pages = 10; // max antal pages att visa
    max_half = Math.floor(max_pages/2);
    let start, end;

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

    // skapar en fragment
    const fragment_pages = document.createDocumentFragment();

    // skapar listan till pages
    const pages = document.createElement('tr');
    pages.className = "pages_list_align"

    page_list.forEach((page_list) => { // lägger till page numret för varenda array inom listan och lägger det som en child till pages

        list = document.createElement('td');
        pageNum = document.createElement('a');
        pageNum.className = 'pages';
        pageNum.innerText = page_list;
        pageNum.href = `/hacking.html?page=${page_list}#`;
        if (page_list === currentpage) {
            pageNum.style.color = 'white';
            pageNum.href = `#`;
        }

        list.appendChild(pageNum);

        pages.appendChild(list);
    });

    // lägger till pages som en child till fragment
    fragment_pages.appendChild(pages);
    // lägger till fragment som en child till page_container
    page_countContainer.appendChild(fragment_pages);
}


document.addEventListener("DOMContentLoaded", function() { // för när webbsidan har laddats
    const password_changed = searchParams.get('password_changed') // kollar om användaren hade nyss kommit tillbaka från att byta deras lösenord

    function getUserIdFromToken() { // en funktion för att decryptera jwt token
        const token = document.cookie.split('; ').find(row => row.startsWith('token='))?.split('=')[1];
        if (token) {
            const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
            return payload; 
        } else {
        return null;
        }
    }

    const token = getUserIdFromToken();
    flags = token.flags;
    time = token.time;

     // kollar om password_changed variabeln är sant och annars kollar om användaren har klarat hela utmaningen
    if (password_changed) {
        document.getElementById('website_message').innerText = 'Lösenordet har ändrats'
    } else if (time !== null && time !== "null") {
        document.getElementById(`website_message`).innerText = `GRATTIS DU HAR KLARAT ALLA UTMANINGAR!!!! \n Din tid: ${time}`
    }

    async function get_categories(page, flagString) { // får alla kategorier för page
        try {
            flags = []; // skapar/tömmer en lista för att senare lägga alla flaggor i

            flagString.forEach(flagString => { // för varenda flagga inom flagstring översätter det till utf8 och sedan lägger till det i flags
                utf8Flag = correctDoubleEncoding(flagString);
                flags.push(utf8Flag);
            }); 

            const categories_page = document.getElementById('categories');

            categories_page.textContent = 'Loading categories...';
            
            const data = { // skapar datan för att skicka till servern
                page: page, 
                flags: flags
            };

            const res = await fetch ('/flags/get_category', { // skickar datan till servern
                method: "POST",
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(data),
            });

            if (res.ok) { // om servern svarar med status kod 200 så börjar den skapar webbsidan
                response = await res.json(); // väntar för hela requesten att bli klar

                const page_count = JSON.parse(response.page); // får antal pages och gör den till en intiger

                rebuildPages(page_count); // kallar på rebuildpages funktionen

                const categories = JSON.parse(response.categories); // parsar categories som en JSON lista

                const fragment = document.createDocumentFragment(); // skapar en document fragment för att lägga element i

                categories.forEach((categories) => { // för varenda värde inom variabeln categories skapar det flaggorna
                    if (categories.percentage === 100) { 
                        completed = "💀";
                    } else {
                        completed = ""
                    }
                    const row = document.createElement('div');
                    row.className = 'flag-box flag-head category-box';
                    row.innerHTML = `
                    <div class="progess_bar" style="width:100%;">
                        <div class="w3-container progess_bar_container" style="width:${categories.percentage}%">${categories.percentage}%</div>
                    </div>
                    <div class="category-info-aign">             
                        <h1 class="text">${categories.category + completed}</h1>
                        <span class="text">klarat: ${categories.completed}/${categories.total}</span>
                    </div> 
                    <div>
                        <button class="btn-category" onclick="view_category_detail('${categories.category}');location.href='${url}#${categories.category}';">Visa mer &#129122;</button>
                    </div>`

                    fragment.appendChild(row); // lägger till fragment som en child
                });

                categories_page.innerHTML = ''; // tömmer categories_page
                categories_page.appendChild(fragment); // lägger till categories_page som en child
            } else {
                categories_page.innerHTML = `${res.status}: ${await res.text()}`;
            }
        } catch (error) {
            console.error("Oops an error occurred: " + error.message)
        };
    };

    

    get_categories(page, flags) // kallar på funktionen för att skapa kategorier
});

function close_category_detail() { // funktionen för att stänga kategorier
    menu_flags = document.getElementById("menu-flags")
    menu_flags.style.display = "none";
    location.href = url + '#';
}

function correctDoubleEncoding(str) { // funktionen för att encoda till UTF-8
    const Bytes = new Uint8Array([...str].map(c => c.charCodeAt(0)));
    
    return new TextDecoder('utf-8').decode(Bytes);
  }

async function view_category_detail(category) { // funktion för att få kategori flags från servern
    try {
        menu_flags = document.getElementById("menu-flags"); 
        category_element = document.getElementById("view_category_details");

        menu_flags.style.display = "flex";
        menu_flags.style.flexDirection = "row-reverse";

        category_element.innerText = "Loading flags..."

        const data = { // skapar data för att skicka till servern
            category: category,
        };

        const res = await fetch('/flags/get_category_flags', { // skickar post request till servern
            method: "POST",
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(data),
        });
        if (res.ok) { // om servern svarade med status kod 200
            response = await res.json();

            const flags = JSON.parse(response.category); // lägger till det som en lista

            const fragment = document.createDocumentFragment(); // skapar en fragment för att lägga till flaggorna

            flags.forEach((flags) => { // skapar flaggan för varenda värde inom flags
                const row = document.createElement('div');
                row.className = 'flag-box';
                row.style.backgroundColor = '#4040da'
                row.innerHTML = `                
                <div class="flag-head">
                    <h1 class="text">${flags.name}</h1>
                    <a class="font text-color" href="${flags.url}" target="_blank">https://PwnMe.${flags.name}.box/</a>
                    <p class="text">poäng: <span class="difficulty-${flags.difficulty}">${flags.points}</span></p>
                    <p class="text">svårighet: <span class="difficulty-${flags.difficulty}">${flags.difficulty}</span></p>
                    <p class="text" style="margin-top:1.5vh">${flags.description}</span></p>
                </div>
                <div class="flag-info">
                    <p class="font" id="flag_answear_${flags.name}_info" style="height: 15px;"></p>
                </div>
                <div class="flag-input">
                    <input autocomplete="off" type="text" id="${flags.name}_flag" class="input font" placeholder="FLAG">
                    <button id="${flags.name}_button" class="btn" onclick="flag_answear('${flags.name}')">Skicka</button>
                </div>`
                fragment.appendChild(row); // lägger till det som en child inom fragment
            })

            category_element.innerHTML = ''; // tömmer kategori
            category_element.appendChild(fragment); // lägger fragment som en child till kategori
            
            // Add flag checking logic here after flags are rendered
            function getUserIdFromToken() { // function för att få användarens token
                const token = document.cookie.split('; ').find(row => row.startsWith('token='))?.split('=')[1];
                const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
                return payload; 
            }

            const token = getUserIdFromToken(); // lägger användarens token inom variabeln token
            const user_flags = token.flags; // användarens flaggor
            const time = token.time; // användarens tid

            function flag_check(flagString) {  // function för att hitta alla element korrelerade med användarens flaggor
                flag_name = correctDoubleEncoding(flagString); // encrypterar till utf8 för bokstaver som Å, Ä, Ö
                const flag_button = document.getElementById(`${flag_name}_button`);
                const flag_input = document.getElementById(`${flag_name}_flag`);
                const flag_info = document.getElementById(`flag_answear_${flag_name}_info`);
                
                if (flag_button && flag_input && flag_info) { // modiferar flaggans button och input ifall användaren redan har den
                    flag_button.disabled = true;
                    flag_button.style.cursor = "default";
                    flag_button.classList.remove("btn");
                    flag_button.classList.add("button-disabled");
                    flag_input.disabled = true;
                    flag_info.innerText = "PWNED!!";
                }
            }

            user_flags.forEach(flag => { //kör funktionen för alla flags
                flag_check(flag);
            });

            if (time !== null && time !== "null") { // om användarens tid är inte null eller "null" så skriver den att användaren har klarat utmaningen med tid x
                document.getElementById(`website_message`).innerText = `GRATTIS DU HAR KLARAT ALLA UTMANINGAR!!!! \n Din tid: ${time}`;
            }
        } else {
            category_element.innerHTML = `${res.status}: ${await res.text()}`;
        }
    } catch (error) {
        console.error("Oops an error occurred: " + error.message)
    }
}