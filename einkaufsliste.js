// js/einkaufsliste.js
document.addEventListener('DOMContentLoaded', () => {
    // Firebase DB Referenz (stelle sicher, dass firebase in firebase-config.js initialisiert wurde)
    if (typeof firebase === 'undefined' || !firebase.database) {
        console.error("Firebase ist nicht initialisiert. Stelle sicher, dass firebase-config.js korrekt geladen wird.");
        alert("Fehler bei der Verbindung zur Datenbank. Bitte Seite neu laden.");
        return;
    }
    const db = firebase.database();
    const shoppingListRef = db.ref('einkaufsliste');

    // DOM Elemente
    const itemNameInput = document.getElementById('itemNameInput');
    const decreaseQuantityBtn = document.getElementById('decreaseQuantityBtn');
    const itemQuantityDisplay = document.getElementById('itemQuantityDisplay');
    const increaseQuantityBtn = document.getElementById('increaseQuantityBtn');
    const addItemBtn = document.getElementById('addItemBtn');
    const shoppingListItemsUl = document.getElementById('shoppingListItems');
    const completedListItemsUl = document.getElementById('completedListItems');

    const chefModeBtn = document.getElementById('chefModeBtn');
    const passwordModal = document.getElementById('passwordModal');
    const passwordModalClose = passwordModal.querySelector('.password-modal-close');
    const passwordInput = document.getElementById('passwordInput');
    const submitPasswordBtn = document.getElementById('submitPasswordBtn');
    const passwordErrorMsg = document.getElementById('passwordErrorMsg');

    let currentQuantity = 1;
    let isChefMode = false;
    let shoppingList = {}; // Lokaler Speicher der Liste

    // --- Hilfsfunktionen ---
    function updateQuantityDisplay() {
        itemQuantityDisplay.textContent = currentQuantity;
        decreaseQuantityBtn.disabled = currentQuantity <= 1;
    }

    function formatDate(timestamp) {
        if (!timestamp) return '';
        const date = new Date(timestamp);
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0'); // Monate sind 0-basiert
        const year = date.getFullYear();
        return `${day}.${month}.${year}`;
    }

    // --- Produkt hinzufügen und Mengensteuerung ---
    increaseQuantityBtn.addEventListener('click', () => {
        currentQuantity++;
        updateQuantityDisplay();
    });

    decreaseQuantityBtn.addEventListener('click', () => {
        if (currentQuantity > 1) {
            currentQuantity--;
            updateQuantityDisplay();
        }
    });

    addItemBtn.addEventListener('click', () => {
        const itemName = itemNameInput.value.trim();
        if (!itemName) {
            alert("Bitte Produktname eingeben.");
            return;
        }

        const newItem = {
            name: itemName,
            quantity: currentQuantity,
            addedTimestamp: firebase.database.ServerValue.TIMESTAMP, // Firebase Server Zeitstempel
            completed: false,
            completedTimestamp: null
        };

        shoppingListRef.push(newItem)
            .then(() => {
                console.log("Produkt hinzugefügt:", itemName);
                itemNameInput.value = ''; // Feld leeren
                currentQuantity = 1;      // Menge zurücksetzen
                updateQuantityDisplay();
            })
            .catch(error => {
                console.error("Fehler beim Hinzufügen des Produkts:", error);
                alert("Fehler beim Hinzufügen. Bitte erneut versuchen.");
            });
    });

    // --- Liste Rendern ---
    function renderShoppingList() {
    shoppingListItemsUl.innerHTML = '';
    completedListItemsUl.innerHTML = '';

    const itemsArray = Object.entries(shoppingList).map(([id, item]) => ({ id, ...item }));

    itemsArray.sort((a, b) => {
        if (a.completed && !b.completed) return 1;
        if (!a.completed && b.completed) return -1;
        if (a.completed && b.completed) {
            return b.completedTimestamp - a.completedTimestamp;
        }
        return a.addedTimestamp - b.addedTimestamp;
    });

    itemsArray.forEach(itemData => {
        const { id, name, quantity, addedTimestamp, completed, completedTimestamp } = itemData;
        const li = document.createElement('li');
        li.dataset.itemId = id;
        if (completed) {
            li.classList.add('completed');
        }

        li.innerHTML = `
            <input type="checkbox" class="item-checkbox" ${completed ? 'checked' : ''} ${!isChefMode ? 'disabled' : ''}>
            <div class="item-info">
                <span class="item-name">${name} (Menge: ${quantity})</span>
                <span class="item-details">Hinzugefügt: ${formatDate(addedTimestamp)} ${completed ? `| Erledigt: ${formatDate(completedTimestamp)}` : ''}</span>
            </div>
            ${isChefMode ? `<button class="delete-item-btn" title="Produkt löschen">🗑️</button>` : ''}
        `;

        if (completed) {
            completedListItemsUl.appendChild(li);
        } else {
            shoppingListItemsUl.appendChild(li);
        }

        // Event Listener für Checkbox
        li.querySelector('.item-checkbox').addEventListener('change', (event) => {
            // Diese anonyme Funktion ist dein "handleItemCheckboxChange"
            if (!isChefMode) {
                event.preventDefault();
                // Optional: Checkbox visuell zurücksetzen, falls sie durch den Klick geändert wurde, bevor preventDefault wirkt
                // event.target.checked = !event.target.checked; 
                return;
            }
            // Dein console.log("rendert"+isChefMode); hattest du hier, das ist okay zum Debuggen.
            const itemId = event.target.closest('li').dataset.itemId;
            const isChecked = event.target.checked;
            const updates = {
                completed: isChecked,
                completedTimestamp: isChecked ? firebase.database.ServerValue.TIMESTAMP : null
            };
            shoppingListRef.child(itemId).update(updates)
                .catch(err => {
                    console.error("Fehler beim Aktualisieren des Erledigt-Status:", err);
                    // Optional: Checkbox bei Fehler zurücksetzen
                    // event.target.checked = !isChecked; 
                });
        });

        // KORRIGIERTE PLATZIERUNG für den Delete-Button Event-Listener:
        // Er wird direkt beim Erstellen des li hinzugefügt, wenn der Chef-Modus aktiv ist.
        if (isChefMode) {
            const deleteBtn = li.querySelector('.delete-item-btn');
            if (deleteBtn) { // Sicherstellen, dass der Button auch wirklich im HTML ist
                deleteBtn.addEventListener('click', handleDeleteItem); // Ruft deine bestehende handleDeleteItem Funktion auf
            }
        }
    });
}

    // --- Firebase Daten Listener ---
    shoppingListRef.on('value', (snapshot) => {
        const data = snapshot.val();
        shoppingList = data || {}; // Update lokalen Speicher
        renderShoppingList();    // Neu rendern
    });

    // --- Chef-Modus und Passwort Modal ---
    chefModeBtn.addEventListener('click', () => {
        if (isChefMode) {
            isChefMode = false;
            chefModeBtn.textContent = "CHEF";
            chefModeBtn.style.backgroundColor = '#ffc107'; // Gelb
            renderShoppingList(); // Checkboxen deaktivieren
            alert("Chef-Modus deaktiviert.");
        } else {
            passwordModal.style.display = 'block';
            passwordInput.value = '';
            passwordErrorMsg.style.display = 'none';
            passwordInput.focus();
        }
    });


    function handleDeleteItem(event) {
    // Der Event-Listener ist nur aktiv/angehängt, wenn isChefMode true ist,
    // aber eine zusätzliche Prüfung schadet nicht.
    if (!isChefMode) {
        alert("Löschen ist nur im CHEF-Modus möglich.");
        return;
    }

    const button = event.target; // Der geklickte Button
    const listItem = button.closest('li'); // Das Elternelement <li> finden
    const itemId = listItem.dataset.itemId; // Die ID des Items aus dem data-Attribut des <li> holen

    if (!itemId) {
        console.error("Konnte Item-ID zum Löschen nicht finden.");
        return;
    }

    // Produktnamen für die Bestätigungsnachricht holen (optional)
    const itemName = shoppingList[itemId]?.name || "Dieses Produkt"; // shoppingList ist deine globale Variable mit den Daten

    // Bestätigungsdialog (empfohlen)
    if (confirm(`Soll "${itemName}" wirklich von der Einkaufsliste gelöscht werden?`)) {
        console.log("Lösche Item mit ID:", itemId);
        shoppingListRef.child(itemId).remove()
            .then(() => {
                console.log("Item erfolgreich aus Firebase gelöscht:", itemId);
                // Die Liste wird automatisch durch den 'value'-Listener von Firebase neu gerendert.
            })
            .catch(error => {
                console.error("Fehler beim Löschen des Items aus Firebase:", itemId, error);
                alert("Fehler beim Löschen des Produkts.");
            });
    }
}

    function closePasswordModal() {
        passwordModal.style.display = 'none';
        passwordErrorMsg.style.display = 'none';
    }

    passwordModalClose.addEventListener('click', closePasswordModal);
    passwordModal.addEventListener('click', (event) => { // Schließen bei Klick außerhalb
        if (event.target === passwordModal) {
            closePasswordModal();
        }
    });

    submitPasswordBtn.addEventListener('click', () => {
        if (passwordInput.value === "0807") {
            isChefMode = true;
            chefModeBtn.textContent = "CHEF (aktiv)";
            chefModeBtn.style.backgroundColor = '#28a745'; // Grün
            closePasswordModal();
            renderShoppingList(); // Checkboxen aktivieren
        } else {
            // Hier die vom Benutzer gewünschte Nachricht, alternativ eine neutrale
            passwordErrorMsg.textContent = "Arschloch falsches Passwort";
            passwordErrorMsg.style.display = 'block';
            passwordInput.value = '';
            passwordInput.focus();
        }
    });

    // Initialisierung
    updateQuantityDisplay();
    // renderShoppingList(); // Wird durch den Firebase 'value' Listener beim ersten Mal aufgerufen
});