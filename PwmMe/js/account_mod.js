document.addEventListener('DOMContentLoaded', function() {
    try {
        // hittar ellementen där id är dropdown_content_menu och dropdown_nav_menu och sparar det i ett variabel
        dropdown_content_menu = document.getElementById('dropdown_content_menu');
        dropdown_nav_menu = document.getElementById('dropdown_nav_menu');

        function getUserIdFromToken() {
            // decrypterar användarens jwt token och tar mittendelen som har användarens info såsom role, namn, flags och status
            const token = document.cookie.split('; ').find(row => row.startsWith('token='))?.split('=')[1];
            if (token) {
                const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
                return payload; 
            } else {
            return null;
            }
        }

        // sparar användarens decrypterad info i user_token
        const user_token = getUserIdFromToken()

        // tar användarens role
        const role = user_token.role

        if (role !== "user") { // om användarens role är inte user. lägg till en option som leder användaren till moderator panel och admin panel
            // obs detta endast ändrar frontend och betyder inte att användaren har tillgång till dessa sidor bara för att hen kan se dessa i sidan
            dropdown_content_menu.innerHTML = `
            <a class="content" href="/hacking.html" id="account_dropdown">Hacking</a>
            <a class="content" href="/leaderboard.html?page=1">Topplista</a>
            <a class="content" href="/account.html">Konto</a>
            <a class="content" href="/${role}/${role}_panel.html">${role} panel</a>
            <a class="content" href="/change_password.html">Byt lösenord</a>
            <a class="content" href="/account.html">Visa konto</a>
            <a class="content" href="/logout">Logga ut</a>
            `
            dropdown_nav_menu.innerHTML = `
            <a class="content" href="/${role}/${role}_panel.html">${role} panel</a>
            <a class="content" href="/change_password.html">Byt lösenord</a>
            <a class="content" href="/account.html">Visa konto</a>`
        }



    } catch (error) {
        console.error("Oops an error occurred: " + error)
    }
})