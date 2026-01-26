async function register() {
    try {
        const username = document.getElementById('username').value; // får värdet för användaren inloggning
        const password = document.getElementById('password').value;

        const data = { // skapar datan för att skicka över till servern
            username: username,
            password: password,
        };

        const res = await fetch('/register', { // skickar en post request till servern
            method: "POST",
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify(data),
        });

        if (res.ok) { // om servern svarade med status kod 200 så redirectar användaren till /
            return window.location.replace("/");
            
        } else { // annars skriver den ut errorn och avslutar functionen
            info_register.innerText = await res.text();
            return;
        }
    } catch (error) {
        info_register.innerText = error.message;
    }
}

window.addEventListener("DOMContentLoaded", (event) => { // för att kolla om användaren hade skrivit enter i input för att skicka över datan till servern
    document.getElementById("password").addEventListener("keydown", function (event) {
        if (event.key === "Enter") {
            event.preventDefault();
            register();
        }
    })
    document.getElementById("username").addEventListener("keydown", function (event) {
        if (event.key === "Enter") {
            event.preventDefault();
            register();
        }
    })
});