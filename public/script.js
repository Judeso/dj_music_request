async function createEvent() {
    try {
        // Récupérer les données du formulaire
        const formData = new FormData(document.getElementById('event-form'));
        const eventData = Object.fromEntries(formData.entries());
        
        // Convertir en format attendu
        const event = {
            name: eventData.name,
            type: eventData.type,
            date: eventData.date,
            location: eventData.location,
            expectedGuests: parseInt(eventData.expectedGuests),
            status: 'preparation',
            description: eventData.description || ''
        };

        // Appel API
        const response = await fetch('/.netlify/functions/events', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(event)
        });

        const result = await response.json();
        
        if (result.success) {
            alert('✅ Événement créé avec succès!');
            window.location.reload();
        } else {
            alert('❌ Erreur: ' + result.error);
        }
    } catch (error) {
        console.error('Erreur:', error);
        alert('❌ Erreur de connexion');
    }
}

// Attacher l'événement au bouton
document.addEventListener('DOMContentLoaded', function() {
    const button = document.querySelector('[onclick*="create"], #create-btn');
    if (button) {
        button.onclick = createEvent;
        console.log('✅ Bouton attaché');
    }
});
