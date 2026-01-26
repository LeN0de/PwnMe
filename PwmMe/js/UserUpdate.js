document.addEventListener('DOMContentLoaded', () => { // skapar ett websocker åt användaren för realtid konto uppdatering 
    const eventSource = new EventSource(`/user/RealTimeUpdate`);

    eventSource.onmessage = (e) => {
        try {
        const data = JSON.parse(e.data);
        document.cookie = `token=${data.token}; path=/`;
        } catch (error) {
            console.error('Error parsing user data:', error);
        }
    };
    eventSource.onerror = (error) => {
        console.error('Connection error:', error);
    };
});