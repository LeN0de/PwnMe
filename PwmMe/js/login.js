async function login() { // function för att skicka användarens inloggning
    try {
        const username = document.getElementById('username').value; // får användarens inloggning inom elementet
        const password = document.getElementById('password').value;

        const data = { // skapar datan för att skicka till servern
            username: username,
            password: password,
        };
        
        const res = await fetch('/login', { // skickar över till servern
            method: "POST",
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(data),
        });
        if (!res.ok) { // om servern inte svarade med status kod 200 så skriver det ut errorn och avslutar functionen
            info_login.innerText = await res.text();
            return;
        }

        return window.location.replace("/hacking.html"); // annars redirectar användaren till /hacking.html
    } catch (error) {
        info_login.innerText = "Error: " + error.message;
    }
}

window.addEventListener("DOMContentLoaded", (event) => { // för att kolla om användaren hade skrivit enter i input för att skicka över datan till servern
    document.getElementById("password").addEventListener("keydown", function (event) {
        if (event.key === "Enter") {
            event.preventDefault();
            login();
        }
    })
    document.getElementById("username").addEventListener("keydown", function (event) {
        if (event.key === "Enter") {
            event.preventDefault();
            login();
        }
    })
});