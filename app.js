// Wichtig: Firebase muss initialisiert sein (siehe firebase-config.js)
// const db = firebase.database(); // Für Firebase Realtime Database

// Aktueller Zustand der Anwendung
let currentState = 'dateSelection';
let selectedDate = null;
let selectedChecklistType = null;
let currentChecklistData = {}; // Hält die aktuellen Daten der geladenen Checkliste

// DOM Elemente
const backButton = document.getElementById('backButton');
const dateSelectionSection = document.getElementById('dateSelection');
const dateSelector = document.getElementById('dateSelector');
const submitDateButton = document.getElementById('submitDate');
const checklistTypeSelectionSection = document.getElementById('checklistTypeSelection');
const checklistContainer = document.getElementById('checklistContainer');
const appContainer = document.getElementById('appContainer');
const imageModal = document.getElementById('imageModal');
const modalImageContent = document.getElementById('modalImageContent');
const modalCloseBtn = document.querySelector('.modal-close-btn');
const modalCaption = document.getElementById('modalCaption');

const faesserProdukte = ["Guinness", "Kilkenny", "Cider", "Hop House", "Pils", "Apfelwein", "Landbier", "Büble Helles", "Staropramen"];
const getraenkeProdukte = ["Cola", "Sprite", "Pepsi", "Pepsi Max", "Schwipp Schwapp"];
let activeProductModalType = null; // 'faesser' oder 'getraenke'
let activeProductModalSectionId = null; // z.B. 'section-2'
let productModalData = { counts: {}, checkedStates: {} }; // Hält die Daten für das aktuell geöffnete Popup
let productModalCurrentPage = 1;


// Produkt Modal Konstanten
const productModal = document.getElementById('productModal');
const productModalTitle = document.getElementById('productModalTitle');
const productModalCloseBtn = productModal.querySelector('.product-modal-close-btn'); // Genauer selektieren
const productItemsContainerPage1 = document.getElementById('productItemsContainerPage1');
const productModalNextBtn = document.getElementById('productModalNextBtn');
const productPage1Div = document.getElementById('productPage1');
const productPage2Div = document.getElementById('productPage2');
const productChecklistContainerPage2 = document.getElementById('productChecklistContainerPage2');
const productModalBackBtn = document.getElementById('productModalBackBtn');
// --- Datumslogik ---
function getWorkingDays() {
    const days = [];
    const now = new Date(); // Der aktuelle Zeitpunkt

    // Bestimme den Kalendertag, der als aktuellster Startpunkt für die Liste dienen soll.
    let referenzTagFürListe = new Date(now);

    // Wenn es vor 07:00 Uhr am *aktuellen Kalendertag* ist,
    // soll die Checkliste für den *aktuellen Kalendertag* noch nicht im Dropdown erscheinen.
    // Der "aktuellste" Tag im Dropdown ist dann der vorherige Arbeitstag.
    if (now.getHours() < 7) {
        referenzTagFürListe.setDate(now.getDate() - 1);
    }

    // Setze die Uhrzeit auf 00:00:00, um saubere Tagesvergleiche zu haben
    referenzTagFürListe.setHours(0, 0, 0, 0);

    // Sammle von diesem referenzTagFürListe rückwärts die letzten 3 Arbeitstage (Di-Sa)
    let anzahlGefundenerTage = 0;
    for (let i = 0; anzahlGefundenerTage < 3 && i < 10; i++) { // i < 10 als Sicherheitslimit
        let potenziellerArbeitstag = new Date(referenzTagFürListe);
        potenziellerArbeitstag.setDate(referenzTagFürListe.getDate() - i);

        const tagInWoche = potenziellerArbeitstag.getDay(); // 0 = Sonntag, ..., 6 = Samstag

        // Überprüfen, ob es ein Arbeitstag ist (Dienstag=2 bis Samstag=6)
        if (tagInWoche >= 2 && tagInWoche <= 6) {
            days.push(new Date(potenziellerArbeitstag)); // Füge das Datum hinzu (ist bereits auf 00:00:00 gesetzt)
            anzahlGefundenerTage++;
        }
    }
    return days; // Die Tage sind bereits in der gewünschten Reihenfolge (aktuellster zuerst)
}

function formatDate(date) {
    const options = { year: 'numeric', month: '2-digit', day: '2-digit' };
    return date.toLocaleDateString('de-DE', options);
}

function formatDateForDB(date) { // Format für Datenbank-Pfade
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function populateDateSelector() {
    dateSelector.innerHTML = ''; // Vorherige Optionen löschen
    const workingDays = getWorkingDays(); // Ruft die neue Logik auf

    workingDays.forEach(date => {
        const option = document.createElement('option');
        option.value = formatDateForDB(date);
        // Die isToday() Funktion vergleicht das Datum aus der Liste mit dem *aktuellen Kalendertag*
        option.textContent = formatDate(date) + (isToday(date) ? ' (Heute)' : '');
        dateSelector.appendChild(option);
    });

    // Wähle den aktuellsten verfügbaren Tag standardmäßig aus,
    // oder den tatsächlichen heutigen Tag, wenn er in der Liste ist.
    const aktuellerKalendertagDBFormat = formatDateForDB(new Date());
    if (dateSelector.querySelector(`option[value="${aktuellerKalendertagDBFormat}"]`)) {
        dateSelector.value = aktuellerKalendertagDBFormat;
    } else if (workingDays.length > 0) {
        // Wenn der heutige Kalendertag (z.B. vor 07:00 Uhr) nicht in der Liste ist,
        // wähle den ersten (aktuellsten) Tag aus der generierten Liste.
        dateSelector.value = formatDateForDB(workingDays[0]);
    }
}

function isToday(someDate) {
    const today = new Date();
    return someDate.getDate() === today.getDate() &&
           someDate.getMonth() === today.getMonth() &&
           someDate.getFullYear() === today.getFullYear();
}

// --- Navigations- und Zustandslogik ---
function updateView() {
    dateSelectionSection.style.display = 'none';
    checklistTypeSelectionSection.style.display = 'none';
    checklistContainer.style.display = 'none';
    backButton.style.display = 'none';

    if (currentState === 'dateSelection') {
        dateSelectionSection.style.display = 'block';
    } else if (currentState === 'checklistTypeSelection') {
        checklistTypeSelectionSection.style.display = 'block';
        backButton.style.display = 'block';
    } else if (currentState === 'checklistView') {
        checklistContainer.style.display = 'block';
        backButton.style.display = 'block';
    }
}

backButton.addEventListener('click', () => {
    if (currentState === 'checklistView') {
        currentState = 'checklistTypeSelection';
        // Wichtig: Änderungen könnten hier ggf. verloren gehen, wenn nicht gespeichert
        // Optional: Listener entfernen, um Datenverlust zu vermeiden oder Auto-Save
        if (currentDataRef) {
            currentDataRef.off(); // Listener von Firebase entfernen
        }
    } else if (currentState === 'checklistTypeSelection') {
        currentState = 'dateSelection';
        selectedDate = null;
    }

    updateView();
});

if (modalCloseBtn) { // Stelle sicher, dass das Element existiert
    modalCloseBtn.addEventListener('click', () => {
        if (imageModal) { // Stelle sicher, dass das Modal-Element existiert
            imageModal.style.display = "none";
            modalImageContent.src = ""; // Bildquelle leeren, um Flackern beim nächsten Öffnen zu vermeiden
        }
    });
}

// Optional: Modal schließen, wenn auf den dunklen Hintergrund geklickt wird
if (imageModal) { // Stelle sicher, dass das Modal-Element existiert
    imageModal.addEventListener('click', (event) => {
        // Überprüfen, ob der Klick direkt auf den Modal-Hintergrund (imageModal selbst)
        // und nicht auf ein Kindelement (wie das Bild modalImageContent) erfolgte.
        if (event.target === imageModal) {
            imageModal.style.display = "none";
            modalImageContent.src = ""; // Bildquelle leeren
        }
    });
}

submitDateButton.addEventListener('click', () => {
    selectedDate = dateSelector.value;
    if (selectedDate) {
        currentState = 'checklistTypeSelection';
        updateView();
    }
});

checklistTypeSelectionSection.addEventListener('click', (event) => {
    if (event.target.tagName === 'BUTTON') {
        selectedChecklistType = event.target.dataset.type;
        currentState = 'checklistView';
        loadChecklist();
        updateView();
    }
});

if (productModalNextBtn) {
    productModalNextBtn.addEventListener('click', () => {
        renderProductPage2(true); // Explizit true übergeben, da dieser Pfad bearbeitbar ist
    });
}
if (productModalBackBtn) {
    productModalBackBtn.addEventListener('click', renderProductPage1);
}
if (productModalCloseBtn) { // Der X-Button im Produkt-Modal
    productModalCloseBtn.addEventListener('click', closeProductModal);
}
if (productModal) { // Schließen bei Klick außerhalb des Modal-Inhalts
    productModal.addEventListener('click', (event) => {
        if (event.target === productModal) { // Klick auf den Hintergrund
            closeProductModal();
        }
    });
}


// --- Checklisten-Logik ---
const barChecklistStructure = [
    {
        title: "Cocktailbar",
        nameField: true,
        items: [
            "Flaschenaufsätze in der Spülmaschine reinigen",
            "Flächen reinigen mit Schwamm und trocken abwischen",
            "Kühlschranktüren abwischen und Lichter ausschalten",
            "Cocktailbar Flaschen sortieren und verschließen"
        ],
        allowImageUpload: true
    },
    {
        title: "Auffüllen",
        nameField: true,
        items: ["Spirituosen", "Weißwein/Prosecco", "Softdrinks", "Säfte", "Weizen", "Bier"],
        productButton: "Getränke" // NEU: Typ für den Produktbutton
    },
    {
        title: "Zapfhähne",
        nameField: true,
        items: ["Zapfhähne mit Blasebalg durchspülen", "Ablaufmulde reinigen mit Schwamm und trocken abwischen", "Guinness-Zapfhahn abschrauben"],
        allowImageUpload: true
    },
    {
        title: "Fässer wechseln",
        nameField: true,
        items: ["Leere Fässer im Pfand Lager abstellen", "Fässer auffüllen im Kühlhaus", "Gas abdrehen und Lichtausschalten"],
        productButton: "Fässer", // NEU: Typ für den Produktbutton
        allowImageUpload: true
    },
    {
        title: "Pfand",
        nameField: true,
        items: ["Getränke Pfand ins Lager einräumen und sortieren", "Volle sortierte Pfand Kisten ins Pfand Lager stellen"],
        allowImageUpload: true
    },
    {
        title: "Spülmaschine",
        nameField: true,
        items: ["Alle Gläser durchspülen und in der Bar einsortieren", "Spülmaschine reinigen", "Stopfen entfernen", "Wasser ablaufen lassen", "Spülmaschine ausschalten"]
    },
    {
        title: "Kaffeemaschine",
        nameField: true,
        items: ["Kaffeemaschine abwischen", "Milchansauger in Pitcher mit Wasser und Milchreiniger legen", "Reinigungsprogramm der Kaffeemaschine laufen lassen mit Tablette", "Milchschäumer, Kaffeesatzbehälter und Gitter spülen"],
        allowImageUpload: true
    },
    {
        title: "Mülltonnen",
        nameField: true,
        items: ["Ggf. Altglas wegwerfen", "Müll aus Mülleimern in Müllbeuteln zusammen legen", "Müllbeuteln nach Ladenschluss in Mülltonnen entsorgen"]
    },
    { title: "Anmerkungen", notesField: true, maxLength: 150 }
];

const serviceChecklistStructure = [
    {
        title: "Gastraum",
        nameField: true,
        items: ["Tische abwischen", "Tische umkippen und Stühle hochstellen, wenn durch gewischt werden muss (Schichtleiter)", "Mit Besen durch kehren", "Menü Karten abwischen", "Bar Theke abwischen", "Alle Gläser einsammeln und an der Bar abgeben"],
        allowImageUpload: true
    },
    {
        title: "Raucherraum",
        nameField: true,
        items: ["Tische abwischen", "Tische umkippen und Stühle hochstellen, wenn durch gewischt werden muss (Schichtleiter)", "Mit Besen durch kehren", "Menü Karten abwischen", "Bar Theke abwischen", "Alle Gläser einsammeln und an der Bar abgeben", "Aschenbecher einsammeln, leeren in den Ascheeimer und abwischen", "Ascheimer mit etwas Wasser ablöschen"],
        allowImageUpload: true
    },
    {
        title: "Eingang",
        nameField: true,
        items: ["Alle Gläser einsammeln auch draußen und an der Bar abgeben"]
    },
    { title: "Anmerkungen", notesField: true, maxLength: 150 }
];

function generateChecklistHTML(structure, data = {}) {
    let html = `<h2>${selectedChecklistType === 'bar' ? 'Bar' : 'Service'} Checkliste für ${formatDate(new Date(selectedDate.replace(/-/g, '/')))}</h2>`; // Korrigiertes Datumsformat für Anzeige
    const isEditable = isChecklistEditable();

    structure.forEach((section, sectionIndex) => {
        const sectionId = `section-${sectionIndex}`;
        html += `<div class="checklist-section">`;
        html += `<h3>${section.title}</h3>`;

        if (section.nameField) {
            const nameValue = data[sectionId] && data[sectionId].gemachtVon ? data[sectionId].gemachtVon : '';
            html += `<label for="${sectionId}-name">gemacht von:</label>`;
            html += `<input type="text" id="${sectionId}-name" data-section-id="${sectionId}" data-field="gemachtVon" value="${nameValue}" ${!isEditable ? 'disabled' : ''}>`;
        }

        if (section.items) {
            section.items.forEach((item, itemIndex) => {
                const itemId = `${sectionId}-item-${itemIndex}`;
                const isChecked = data[sectionId] && data[sectionId].items && data[sectionId].items[itemId];
                html += `<div class="checklist-item">
                            <input type="checkbox" id="${itemId}" data-section-id="${sectionId}" data-item-id="${itemId}" ${isChecked ? 'checked' : ''} ${!isEditable ? 'disabled' : ''}>
                            <label for="${itemId}">${item}</label>
                         </div>`;
            });
        }

        if (section.productButton) { 
            html += `<div class="product-button-container" style="margin-top: 10px;">
                        <button class="product-action-btn" data-product-type="${section.productButton.toLowerCase()}" data-section-id="${sectionId}">
                            ${section.productButton} ${isChecklistEditable() ? 'auffüllen' : 'anzeigen'}
                        </button>
                     </div>`;
        }

        if (section.allowImageUpload) {
            const sectionImages = (data[sectionId] && data[sectionId].images) || {};
            const imageCount = Object.keys(sectionImages).length;

            html += `<div class="image-upload-section" data-section-id="${sectionId}">`;
            html += `<h4>Bilder (${imageCount}/2)</h4>`;
            if (isEditable && imageCount < 2) {
                html += `<input type="file" class="image-upload-input" accept="image/*" ${imageCount >= 2 ? 'disabled' : ''}>`;
                html += `<small>Max. 2 Bilder. Max 5MB pro Bild.</small><br>`;
            } else if (isEditable && imageCount >= 2) {
                html += `<small>Maximale Anzahl an Bildern erreicht.</small><br>`;
            }

            html += `<div class="image-preview-container">`;
            for (const imageId in sectionImages) {
                const imageUrl = sectionImages[imageId].url;
                const imageName = sectionImages[imageId].name; // Name des Bildes in Storage
                html += `<div class="image-preview-item" data-image-id="${imageId}" data-image-name="${imageName}">
                            <img src="${imageUrl}" alt="Vorschau" style="max-width: 100px; max-height: 100px; margin-right: 5px;">
                            ${isEditable ? `<button class="delete-image-btn">Löschen</button>` : ''}
                         </div>`;
            }
            html += `</div>`; // Ende image-preview-container
            html += `</div>`; // Ende image-upload-section
        }

        if (section.notesField) {
            const notesValue = data.anmerkungen || '';
            html += `<label for="anmerkungen">Anmerkungen (max. ${section.maxLength} Zeichen):</label>`;
            html += `<textarea id="anmerkungen" data-field="anmerkungen" maxlength="${section.maxLength}" ${!isEditable ? 'disabled' : ''}>${notesValue}</textarea>`;
            html += `<p id="charCountAnmerkungen">0 / ${section.maxLength}</p>`;
        }
        html += `</div>`;
    });

    html += `<div style="margin-top: 30px; margin-bottom: 20px; text-align: center;">
                <a href="einkaufsliste.html" class="navigation-button">Zur Einkaufsliste</a>
             </div>`;

    return html;
}

// --- Firebase Integration (Beispiel mit Realtime Database) ---
let currentDataRef = null; // Hält die Referenz zum aktuellen Firebase Pfad

function loadChecklist() {
    checklistContainer.innerHTML = '<p>Lade Checkliste...</p>';
    const structure = selectedChecklistType === 'bar' ? barChecklistStructure : serviceChecklistStructure;
    const dbPath = `checklisten/${selectedDate}/${selectedChecklistType}`;

    if (currentDataRef) {
        currentDataRef.off(); // Alten Listener entfernen, falls vorhanden
    }
    currentDataRef = firebase.database().ref(dbPath);

    currentDataRef.on('value', (snapshot) => {
        const data = snapshot.val() || {};
        currentChecklistData = data; // Lokalen Datenbestand aktualisieren
        checklistContainer.innerHTML = generateChecklistHTML(structure, data);
        attachEventListenersToChecklist(); // Event Listener nach dem Rendern hinzufügen
        updateAnmerkungenCharCount(); // Zeichenzähler für Anmerkungen aktualisieren
    }, (error) => {
        console.error("Fehler beim Laden der Daten aus Firebase:", error);
        checklistContainer.innerHTML = '<p>Fehler beim Laden der Checkliste.</p>';
    });
}

function attachEventListenersToChecklist() {
    const inputs = checklistContainer.querySelectorAll('input[type="checkbox"], input[type="text"], textarea');
    const isEditable = isChecklistEditable();

    inputs.forEach(input => {
        if (!isEditable) {
            console.log("none")
            input.disabled = true;
            return; // Keine Listener für nicht bearbeitbare Felder
        }
        input.disabled = false;

        if (input.type === 'checkbox') {
            input.addEventListener('change', handleChecklistChange);
        } else if (input.type === 'text') {
            input.addEventListener('change', handleChecklistChange); // 'input' für sofortige Reaktion
        } else if (input.tagName === 'TEXTAREA') {
            input.addEventListener('change', handleChecklistChange);
            input.addEventListener('input', updateAnmerkungenCharCount); // Für Zeichenzähler
        }
    });

    if (isEditable) {
        const imageUploadInputs = checklistContainer.querySelectorAll('.image-upload-input');
        imageUploadInputs.forEach(input => {
            input.addEventListener('change', handleImageUpload);
        });

        const deleteImageButtons = checklistContainer.querySelectorAll('.delete-image-btn');
        deleteImageButtons.forEach(button => {
            button.addEventListener('click', handleDeleteImage);
        });
    }

    const previewImages = checklistContainer.querySelectorAll('.image-preview-item img');
    previewImages.forEach(img => {
        img.addEventListener('click', openImageInModal);
        img.style.cursor = 'pointer'; // Visueller Hinweis, dass das Bild klickbar ist
    });

     checklistContainer.querySelectorAll('.product-action-btn').forEach(button => {
        // Alten Listener entfernen, um Duplikate zu vermeiden, falls attach... mehrfach aufgerufen wird
        // Da wir die Buttons aber bei jedem Checklist-Render neu erstellen, ist das hier nicht zwingend
        // nötig, solange die Logik robust ist. Besser ist es aber oft, sie zu entfernen.
        // Eine einfache Lösung ist, die Listener nicht hier, sondern global mit Event Delegation zu setzen,
        // aber für jetzt belassen wir es so, da der `checklistContainer.innerHTML` alles neu zeichnet.
        button.addEventListener('click', (event) => {
            const type = event.target.dataset.productType;
            const sectionId = event.target.dataset.sectionId;
            openProductModal(type, sectionId);
        });
    });
}

function handleChecklistChange(event) {
    if (!isChecklistEditable()) return; // Doppelte Prüfung

    const target = event.target;
    const dbPath = `checklisten/${selectedDate}/${selectedChecklistType}`;
    let updatePath;
    let value;

    if (target.type === 'checkbox') {
        const sectionId = target.dataset.sectionId;
        const itemId = target.dataset.itemId;
        updatePath = `${dbPath}/${sectionId}/items/${itemId}`;
        value = target.checked;
        // Update lokalen Datenbestand für Konsistenz (optional, da Firebase 'value' Event feuert)
        currentChecklistData[sectionId] = currentChecklistData[sectionId] || { items: {} };
        currentChecklistData[sectionId].items = currentChecklistData[sectionId].items || {};
        currentChecklistData[sectionId].items[itemId] = value;

    } else if (target.type === 'text') {
        const sectionId = target.dataset.sectionId;
        const field = target.dataset.field; // z.B. "gemachtVon"
        updatePath = `${dbPath}/${sectionId}/${field}`;
        value = target.value;
        currentChecklistData[sectionId] = currentChecklistData[sectionId] || {};
        currentChecklistData[sectionId][field] = value;

    } else if (target.tagName === 'TEXTAREA') {
        const field = target.dataset.field; // z.B. "anmerkungen"
        updatePath = `${dbPath}/${field}`;
        value = target.value;
        currentChecklistData[field] = value;
    }

    if (updatePath) {
        firebase.database().ref(updatePath).set(value)
            .catch(error => console.error("Fehler beim Speichern in Firebase:", error));
    }
}

function updateAnmerkungenCharCount() {
    const anmerkungenTextarea = document.getElementById('anmerkungen');
    const charCountDisplay = document.getElementById('charCountAnmerkungen');
    if (anmerkungenTextarea && charCountDisplay) {
        const maxLength = anmerkungenTextarea.maxLength;
        const currentLength = anmerkungenTextarea.value.length;
        charCountDisplay.textContent = `${currentLength} / ${maxLength}`;
    }
}


//Bilder werden eingefügt

function handleImageUpload(event) {
    if (!isChecklistEditable()) return;

    const fileInput = event.target;
    const sectionId = fileInput.closest('.image-upload-section').dataset.sectionId;
    const files = fileInput.files;

    if (!files || files.length === 0) {
        return;
    }

    const file = files[0]; // Nur das erste ausgewählte Bild nehmen, da wir pro Klick eines hochladen

    // Überprüfe aktuelle Anzahl der Bilder für diese Sektion in den Daten
    const currentSectionData = currentChecklistData[sectionId] || {};
    const currentImages = currentSectionData.images || {};
    if (Object.keys(currentImages).length >= 2) {
        alert("Maximale Anzahl von 2 Bildern pro Sektion erreicht.");
        fileInput.value = ""; // Input leeren
        return;
    }

    if (file.size > 5 * 1024 * 1024) { // 5MB Limit
        alert("Datei ist zu groß (max. 5MB).");
        fileInput.value = "";
        return;
    }

    const uniqueImageId = firebase.database().ref().push().key; // Eindeutige ID für das Bild
    const fileExtension = file.name.split('.').pop();
    const uniqueFileNameInStorage = `${uniqueImageId}.${fileExtension}`;
    const storagePath = `checklist_images/${selectedDate}/${selectedChecklistType}/${sectionId}/${uniqueFileNameInStorage}`;
    const storageRef = firebase.storage().ref(storagePath);

    const uploadTask = storageRef.put(file);

    // Zeige einen Ladeindikator (optional, aber empfohlen)
    // z.B. fileInput.disabled = true; fileInput.parentElement.insertAdjacentHTML('beforeend', '<p>Lade hoch...</p>');

    uploadTask.on('state_changed',
        (snapshot) => {
            // Fortschrittsanzeige (optional)
            // const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            // console.log('Upload is ' + progress + '% done');
        },
        (error) => {
            console.error("Upload fehlgeschlagen:", error);
            alert("Bild-Upload fehlgeschlagen: " + error.message);
            // Ladeindikator entfernen
            // fileInput.disabled = false;
        },
        () => {
            // Erfolgreicher Upload
            uploadTask.snapshot.ref.getDownloadURL().then((downloadURL) => {
                const dbPathForImage = `checklisten/${selectedDate}/${selectedChecklistType}/${sectionId}/images/${uniqueImageId}`;
                const imageData = {
                    url: downloadURL,
                    name: uniqueFileNameInStorage, // Wichtig für späteres Löschen aus Storage
                    uploadedAt: firebase.database.ServerValue.TIMESTAMP // Optional: Zeitstempel
                };

                firebase.database().ref(dbPathForImage).set(imageData)
                    .then(() => {
                        console.log("Bild-URL in DB gespeichert.");
                        fileInput.value = ""; // Input leeren für nächste Auswahl
                        // Ladeindikator entfernen
                        // Die UI wird durch den 'value'-Listener auf der Realtime Database automatisch aktualisiert
                    })
                    .catch(error => {
                        console.error("Fehler beim Speichern der Bild-URL in DB:", error);
                        alert("Fehler beim Speichern der Bild-Referenz.");
                        // Ggf. hochgeladenes Bild aus Storage wieder löschen, wenn DB-Eintrag fehlschlägt
                        storageRef.delete().catch(delError => console.error("Konnte verwaistes Bild nicht löschen:", delError));
                    });
            });
        }
    );
}

function handleDeleteImage(event) {
    if (!isChecklistEditable()) return;

    const deleteButton = event.target;
    const imageItemDiv = deleteButton.closest('.image-preview-item');
    const imageId = imageItemDiv.dataset.imageId;
    const imageName = imageItemDiv.dataset.imageName; // Der Name in Storage
    const sectionId = deleteButton.closest('.image-upload-section').dataset.sectionId;

    if (!imageId || !imageName || !sectionId) {
        console.error("Fehlende Daten zum Löschen des Bildes.");
        return;
    }

    if (!confirm("Möchtest du dieses Bild wirklich löschen?")) {
        return;
    }

    // 1. Bild aus Firebase Storage löschen
    const storagePath = `checklist_images/${selectedDate}/${selectedChecklistType}/${sectionId}/${imageName}`;
    firebase.storage().ref(storagePath).delete()
        .then(() => {
            console.log("Bild aus Storage gelöscht.");
            // 2. Bild-Referenz aus Realtime Database löschen
            const dbPathForImage = `checklisten/${selectedDate}/${selectedChecklistType}/${sectionId}/images/${imageId}`;
            return firebase.database().ref(dbPathForImage).remove();
        })
        .then(() => {
            console.log("Bild-Referenz aus DB gelöscht.");
            // UI wird durch den Realtime Database Listener automatisch aktualisiert.
        })
        .catch(error => {
            console.error("Fehler beim Löschen des Bildes:", error);
            alert("Fehler beim Löschen des Bildes: " + error.message);
        });
}


function openImageInModal(event) {
    if (imageModal && modalImageContent) {
        const imageUrl = event.target.src; // Die URL des angeklickten kleinen Bildes
        imageModal.style.display = "block";
        modalImageContent.src = imageUrl;
         if (modalCaption) { // Falls du die Bildunterschrift nutzt
            modalCaption.textContent = event.target.alt || "Checklistenbild";
        }
    }
}

//Produkt Modal
function getProductList(type) {
    if (type === 'fässer') return faesserProdukte;
    if (type === 'getränke') return getraenkeProdukte;
    return [];
}

function renderProductPage1() {
    productItemsContainerPage1.innerHTML = '';
    const products = getProductList(activeProductModalType);
    console.log("renderProductPage1: activeProductModalType =", activeProductModalType, "Produkte =", products); // TEST
    const counts = productModalData.counts || {};

    products.forEach(productName => {
        const count = counts[productName] || 0;
        const itemHTML = `
            <div class="product-item-page1" data-product-name="${productName}">
                <span>${productName}</span>
                <div class="product-controls">
                    <button class="product-minus-btn" ${count === 0 ? 'disabled' : ''}>-</button>
                    <span class="product-count">${count}</span>
                    <button class="product-plus-btn">+</button>
                </div>
            </div>
        `;
        productItemsContainerPage1.insertAdjacentHTML('beforeend', itemHTML);
    });

    // Event Listeners für +/- Buttons
    productItemsContainerPage1.querySelectorAll('.product-plus-btn').forEach(btn => {
        btn.addEventListener('click', handleChangeProductCount);
    });
    productItemsContainerPage1.querySelectorAll('.product-minus-btn').forEach(btn => {
        btn.addEventListener('click', handleChangeProductCount);
    });
    productPage1Div.style.display = 'block';
    productPage2Div.style.display = 'none';
    productModalCurrentPage = 1;
}

// js/app.js

// Parameter hinzugefügt: isViewEditable, Standardwert ist true
function renderProductPage2(isViewEditable = true) {
    productChecklistContainerPage2.innerHTML = ''; // Alten Inhalt leeren
    const counts = productModalData.counts || {};
    const checkedStates = productModalData.checkedStates || {};
    let itemCounter = 0;
    let hasItemsToList = false;

    // Prüfen, ob überhaupt Produkte mit Anzahl > 0 vorhanden sind
    for (const productName in counts) {
        if (counts[productName] > 0) {
            hasItemsToList = true;
            break;
        }
    }

    if (!hasItemsToList) {
        productChecklistContainerPage2.innerHTML = '<li>Es wurde nichts aufgefüllt</li>';
    } else {
        for (const productName in counts) {
            if (counts[productName] > 0) { // Nur Produkte mit Anzahl > 0 anzeigen
                for (let i = 1; i <= counts[productName]; i++) {
                    itemCounter++;
                    const productInstanceId = `${productName.replace(/\s+/g, '_')}_${i}`;
                    const isChecked = checkedStates[productInstanceId] || false;
                    const li = document.createElement('li');
                    // Checkbox wird deaktiviert, wenn isViewEditable false ist
                    li.innerHTML = `
                        <input type="checkbox" id="chk-${productInstanceId}" data-instance-id="${productInstanceId}" 
                               ${isChecked ? 'checked' : ''} ${!isViewEditable ? 'disabled' : ''}>
                        <label for="chk-${productInstanceId}">${productName} (Exemplar ${i})</label>
                    `;
                    productChecklistContainerPage2.appendChild(li);
                }
            }
        }
    }

    if (isViewEditable) {
        // Event Listeners für Checkboxen nur hinzufügen, wenn bearbeitbar
        productChecklistContainerPage2.querySelectorAll('input[type="checkbox"]').forEach(chk => {
            // Sicherstellen, dass nicht mehrere Listener angehängt werden (obwohl bei innerHTML-Reset nicht kritisch)
            // Um ganz sicher zu gehen, könnte man hier eine robustere Listener-Verwaltung betreiben,
            // aber für den Moment sollte es durch das Leeren von productChecklistContainerPage2 reichen.
            chk.addEventListener('click', handleProductCheckboxChange);
        });
        productModalBackBtn.style.display = 'inline-block'; // "Zurück"-Button anzeigen
    } else {
        productModalBackBtn.style.display = 'none'; // "Zurück"-Button ausblenden im Nur-Lese-Modus
    }

    productPage1Div.style.display = 'none';
    productPage2Div.style.display = 'block';
    productModalCurrentPage = 2;
}

// js/app.js

function openProductModal(type, sectionId) {
    activeProductModalType = type;
    activeProductModalSectionId = sectionId;

    const sectionData = currentChecklistData[activeProductModalSectionId] || {};
    const specificProductData = sectionData[activeProductModalType] || { counts: {}, checkedStates: {} };
    // Tiefe Kopie für lokale Bearbeitung oder Anzeige
    productModalData = JSON.parse(JSON.stringify(specificProductData));

    const editable = isChecklistEditable(); // Ist die Hauptcheckliste bearbeitbar?

    if (editable) {
        productModalTitle.textContent = type === 'faesser' ? "Fässer verwalten" : "Getränke verwalten";
        renderProductPage1(); // Starte auf Seite 1 zum Bearbeiten
        productModalNextBtn.style.display = 'inline-block'; // "Weiter"-Button sichtbar
        productModalBackBtn.style.display = 'inline-block'; // "Zurück"-Button prinzipiell sichtbar (für Seite 2)
    } else {
        // Nicht bearbeitbar: Direkt zu Seite 2 (Übersicht)
        productModalTitle.textContent = type === 'faesser' ? "Fässer (Übersicht)" : "Getränke (Übersicht)";
        renderProductPage2(false); // 'false' signalisiert, dass die Ansicht nicht bearbeitbar ist
        productPage1Div.style.display = 'none';  // Seite 1 ausblenden
        productPage2Div.style.display = 'block'; // Seite 2 anzeigen
        productModalNextBtn.style.display = 'none';   // "Weiter"-Button ausblenden
        // Der "Zurück"-Button auf Seite 2 wird in renderProductPage2(false) behandelt
        productModalCurrentPage = 2;
    }
    productModal.style.display = 'block';
}

function closeProductModal() {
    if (productModal) {
        productModal.style.display = 'none';
        activeProductModalType = null;
        activeProductModalSectionId = null;
        productModalData = { counts: {}, checkedStates: {} }; // Zurücksetzen
        productModalCurrentPage = 1;
    }
}

function handleChangeProductCount(event) {
    const button = event.target;
    const productItemDiv = button.closest('.product-item-page1');
    const productName = productItemDiv.dataset.productName;
    const countSpan = productItemDiv.querySelector('.product-count');
    const minusButton = productItemDiv.querySelector('.product-minus-btn');

    let currentCount = parseInt(productModalData.counts[productName] || 0);

    if (button.classList.contains('product-plus-btn')) {
        currentCount++;
    } else if (button.classList.contains('product-minus-btn')) {
        if (currentCount > 0) {
            currentCount--;
        }
    }
    productModalData.counts[productName] = currentCount;
    countSpan.textContent = currentCount;
    minusButton.disabled = currentCount === 0;

    // In Firebase speichern
    const dbPath = `checklisten/${selectedDate}/${selectedChecklistType}/${activeProductModalSectionId}/${activeProductModalType}/counts/${productName}`;
    firebase.database().ref(dbPath).set(currentCount)
        .catch(err => console.error("Fehler beim Speichern der Produktanzahl:", err));
}

function handleProductCheckboxChange(event) {
    const checkbox = event.target;
    const productInstanceId = checkbox.dataset.instanceId;
    productModalData.checkedStates[productInstanceId] = checkbox.checked;

    // In Firebase speichern
    const dbPath = `checklisten/${selectedDate}/${selectedChecklistType}/${activeProductModalSectionId}/${activeProductModalType}/checkedStates/${productInstanceId}`;
    firebase.database().ref(dbPath).set(checkbox.checked)
        .catch(err => console.error("Fehler beim Speichern des Checkbox-Status:", err));

    if (!isChecklistEditable()) { // Zusätzlicher Schutz
        console.warn("Versuch, Produktanzahl zu ändern, obwohl Checkliste nicht bearbeitbar.");
        return;
    }

    if (!isChecklistEditable()) { // Zusätzlicher Schutz
        console.warn("Versuch, Produkt-Checkbox zu ändern, obwohl Checkliste nicht bearbeitbar.");
        return;
    }
}


// --- Zeitliche Beschränkung ---
function isChecklistEditable() {
    if (!selectedDate) return false; // Kein Datum ausgewählt, nicht bearbeitbar

    const now = new Date(); // Der aktuelle Zeitpunkt

    // 1. Bestimme das Kalenderdatum, zu dem der aktuell laufende Arbeitstag (07:00-07:00) gehört.
    // Beispiel: Ist es 06:00 Uhr morgens, gehört man noch zum Arbeitstag des Vortages.
    // Ist es 07:00 Uhr oder später, gehört man zum Arbeitstag des aktuellen Kalendertages.
    let aktivesArbeitstagDatum = new Date(now);
    if (now.getHours() < 7) {
        // Vor 07:00 Uhr morgens: Wir sind im Bearbeitungszeitraum des *vorherigen* Kalendertages.
        aktivesArbeitstagDatum.setDate(now.getDate() - 1);
    }
    // Setze die Stunden auf 0 zurück, um nur das Datum für den Vergleich mit selectedDate zu haben.
    aktivesArbeitstagDatum.setHours(0, 0, 0, 0);
    const aktivesArbeitstagDatumString = formatDateForDB(aktivesArbeitstagDatum); // z.B. "2025-05-17"

    // 2. Hole das vom Benutzer ausgewählte Checklisten-Datum (als String)
    //    selectedDate ist bereits der String im Format "YYYY-MM-DD"

    // 3. Überprüfe, ob die ausgewählte Checkliste die des aktuell aktiven Arbeitstages ist.
    if (selectedDate === aktivesArbeitstagDatumString) {
        // Ja, der Benutzer hat die Checkliste ausgewählt, die zum *aktuell laufenden 24h-Arbeitsblock* gehört.
        // Diese ist bearbeitbar von 07:00 Uhr ihres eigenen Kalendertages bis 07:00 Uhr des nächsten Kalendertages.

        const checklistKalenderDatum = new Date(selectedDate.replace(/-/g, '/')); // Das Datum der ausgewählten Checkliste

        // Start des Bearbeitungsfensters: 07:00 Uhr am Kalendertag der Checkliste
        const fensterStart = new Date(checklistKalenderDatum);
        fensterStart.setHours(7, 0, 0, 0); // z.B. 17.05.2025, 07:00:00

        // Ende des Bearbeitungsfensters: 07:00 Uhr am *Folgetag* des Kalendertages der Checkliste
        const fensterEnde = new Date(checklistKalenderDatum);
        fensterEnde.setDate(checklistKalenderDatum.getDate() + 1); // z.B. auf den 18.05.2025 setzen
        fensterEnde.setHours(7, 0, 0, 0); // z.B. 18.05.2025, 07:00:00

        // Ist der aktuelle Zeitpunkt 'now' innerhalb dieses 24-Stunden-Fensters?
        return now >= fensterStart && now < fensterEnde;
    }

    // Wenn die ausgewählte Checkliste nicht die des aktuell aktiven Arbeitstages ist
    // (z.B. eine ältere Checkliste), ist sie nicht mehr bearbeitbar.
    return false;
}


// --- Initialisierung ---
function init() {
    populateDateSelector();
    updateView();
}

init();