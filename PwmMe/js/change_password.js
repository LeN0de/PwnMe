// function för att skicka den nya lösenordet till servern
async function change_password() {

    const password = document.getElementById('password').value;
    const password_confirm = document.getElementById('confirm_password').value;
    const change_password_info = document.getElementById('change_password_info');
    try {
        const data = { // skapar datan att skicka
            password: password,
            password_confirm: password_confirm,
        };

        // skickar datan till servern
        const res = await fetch('/user/change_password', {
            method: "POST",
            headers: {"content-Type": "application/json"},
            body: JSON.stringify(data),
        });

        if (res.ok) { // om servern svarade med status kod 200 så redirectar användaren till "/hacking.html?password_changed=true"
            return window.location.replace("/hacking.html?password_changed=true");
        } else {
            return change_password_info.innerHTML = `${await res.text()}`;
        }
    } catch (error) {
        return change_password_info.innerHTML = "Oops an error occurred: " + error;
    }
}

// om användaren trycker enter knappen på någon av input boxes så kallar den på funktionen "change_password"
window.addEventListener("DOMContentLoaded", (event) => {
    document.getElementById("confirm_password").addEventListener("keydown", function (event) {
    if (event.key === "Enter") {
        event.preventDefault();
            change_password();
        }
    })
    document.getElementById("password").addEventListener("keydown", function (event) {
    if (event.key === "Enter") {
        event.preventDefault();
            change_password();
        }
    })
});