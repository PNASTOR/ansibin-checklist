document.addEventListener('DOMContentLoaded', () => {
    // Überprüfen, ob Firebase korrekt geladen wurde
    if (typeof firebase === 'undefined') {
        console.error("Firebase ist nicht geladen. Stelle die Einbindung der SDKs sicher.");
        return;
    }

    // --- Konfiguration ---
    const names = ["Mahdi", "Danial", "Fynn", "Paul", "Shirin", "Aarthia", "Avid", "Emmi", "Gabril", "Miri"];
    // Wir verwenden "sichere" Schlüssel für Firebase und mappen sie auf die Anzeige-Namen
    const drinks = {
        "Pepsi": "Pepsi",
        "Eistee": "Eistee",
        "Wasser_klein": "Wasser klein",
        "Wasser_gross": "Wasser groß"
    };

    // --- Firebase Referenz ---
    const db = firebase.database();
    const drinksCounterRef = db.ref('getraenkeZaehler');

    // --- DOM Elemente ---
    const nameGrid = document.getElementById('nameGrid');
    const modal = document.getElementById('drinksModal');
    const modalTitle = document.getElementById('drinksModalTitle');
    const drinksListContainer = document.getElementById('drinksListContainer');
    const modalCloseBtn = modal.querySelector('.drinks-modal-close');

    // --- Globale Variablen ---
    let allDrinksData = {}; // Speichert alle Daten von Firebase
    let activePerson = null;  // Speichert den Namen der Person, dessen Modal offen ist

    // --- Funktionen ---

    // Erstellt das Gitter mit den Namen
    function renderNameGrid() {
        nameGrid.innerHTML = ''; // Gitter leeren
        names.forEach(name => {
            const tile = document.createElement('div');
            tile.className = 'name-tile';
            tile.textContent = name;
            tile.addEventListener('click', () => openDrinksModal(name));
            nameGrid.appendChild(tile);
        });
    }

    // Öffnet das Modal für eine bestimmte Person
    function openDrinksModal(name) {
        activePerson = name;
        modalTitle.textContent = `Getränke für ${name}`;
        renderDrinksList(); // Liste für diese Person rendern
        modal.style.display = 'block';
    }

    // Schließt das Modal
    function closeDrinksModal() {
        modal.style.display = 'none';
        activePerson = null; // Aktive Person zurücksetzen
    }

    // Rendert die Getränkeliste im Modal
    function renderDrinksList() {
        if (!activePerson) return; // Nichts tun, wenn kein Modal offen ist

        drinksListContainer.innerHTML = ''; // Liste leeren
        const personData = allDrinksData[activePerson] || {};

        for (const [drinkKey, drinkName] of Object.entries(drinks)) {
            const count = personData[drinkKey] || 0;
            const itemDiv = document.createElement('div');
            itemDiv.className = 'drink-item';

            itemDiv.innerHTML = `
                <span>${drinkName}</span>
                <div class="drink-controls">
                    <button class="drink-minus-btn" data-drink-key="${drinkKey}" ${count === 0 ? 'disabled' : ''}>-</button>
                    <span class="drink-count">${count}</span>
                    <button class="drink-plus-btn" data-drink-key="${drinkKey}">+</button>
                </div>
            `;
            drinksListContainer.appendChild(itemDiv);
        }

        // Event Listeners für die neuen +/- Buttons hinzufügen
        drinksListContainer.querySelectorAll('.drink-plus-btn, .drink-minus-btn').forEach(btn => {
            btn.addEventListener('click', handleChangeDrinkCount);
        });
    }

    // Verarbeitet Klicks auf +/- Buttons
    function handleChangeDrinkCount(event) {
        if (!activePerson) return;

        const button = event.target;
        const drinkKey = button.dataset.drinkKey;
        const isPlus = button.classList.contains('drink-plus-btn');
        const currentCount = allDrinksData[activePerson]?.[drinkKey] || 0;
        let newCount = isPlus ? currentCount + 1 : currentCount - 1;

        if (newCount < 0) {
            newCount = 0; // Sicherstellen, dass die Anzahl nicht unter 0 fällt
        }

        // Update in Firebase speichern
        drinksCounterRef.child(activePerson).child(drinkKey).set(newCount)
            .catch(err => console.error("Fehler beim Speichern der Getränkeanzahl:", err));
    }

    // --- Event Listeners ---
    modalCloseBtn.addEventListener('click', closeDrinksModal);
    modal.addEventListener('click', (event) => {
        if (event.target === modal) { // Klick auf den Hintergrund
            closeDrinksModal();
        }
    });

    // --- Firebase Daten-Listener (Herzstück der Live-Synchronisation) ---
    drinksCounterRef.on('value', (snapshot) => {
        allDrinksData = snapshot.val() || {}; // Lokale Daten aktualisieren
        console.log("Daten von Firebase erhalten:", allDrinksData);

        // Wenn ein Modal offen ist, dessen Inhalt live aktualisieren
        if (activePerson) {
            renderDrinksList();
        }
    });

    // --- Initialisierung ---
    renderNameGrid(); // Die Seite beim Laden initial aufbauen

});