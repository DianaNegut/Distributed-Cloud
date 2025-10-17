// Ne asigurăm că avem acces la librăria ipfs-http-client, încărcată în HTML
const { create } = window.IpfsHttpClient;

// 1. Ne conectăm la API-ul nodului nostru local IPFS
// Adresa este cea default pentru IPFS Desktop
const client = create({ host: '127.0.0.1', port: 5001, protocol: 'http' });
console.log("Conectat la nodul IPFS!");

// 2. Selectăm elementele HTML cu care vom interacționa
const uploadButton = document.getElementById('upload-button');
const fileInput = document.getElementById('file-input');
const infoDiv = document.getElementById('info');

const fetchButton = document.getElementById('fetch-button');
const cidInput = document.getElementById('cid-input');
const contentDiv = document.getElementById('content');

// 3. Adăugăm logica pentru butonul de UPLOAD
uploadButton.addEventListener('click', async () => {
    const file = fileInput.files[0];
    if (!file) {
        return alert('Te rog selectează un fișier!');
    }

    try {
        // Folosim funcția client.add() pentru a adăuga fișierul în IPFS
        const added = await client.add(file, {
            progress: (prog) => console.log(`received: ${prog}`)
        });
        
        // Rezultatul este un obiect care conține CID-ul
        const cid = added.cid.toString();
        infoDiv.innerHTML = `Fișier adăugat cu succes! <br><b>CID:</b> ${cid}`;
        console.log('Fișier adăugat:', cid);

    } catch (error) {
        console.error('Eroare la adăugarea fișierului:', error);
        infoDiv.innerText = 'A apărut o eroare. Verifică consola.';
    }
});

// 4. Adăugăm logica pentru butonul de FETCH (preluare)
fetchButton.addEventListener('click', async () => {
    const cid = cidInput.value;
    if (!cid) {
        return alert('Te rog introdu un CID!');
    }

    try {
        contentDiv.innerHTML = 'Se încarcă...';
        const chunks = [];
        // Folosim client.cat() pentru a prelua conținutul unui CID
        for await (const chunk of client.cat(cid)) {
            chunks.push(chunk);
        }
        
        // Unim bucățile de date (chunks) într-un singur obiect (Blob)
        const data = new Blob(chunks);

        // Încercăm să detectăm dacă este o imagine pentru a o afișa
        if (data.type.startsWith('image/')) {
            const imageUrl = URL.createObjectURL(data);
            contentDiv.innerHTML = `<img src="${imageUrl}" alt="Imagine din IPFS">`;
        } else {
            // Dacă nu e imagine, afișăm conținutul ca text
            const textContent = await data.text();
            contentDiv.innerText = textContent;
        }

    } catch (error) {
        console.error('Eroare la preluarea fișierului:', error);
        contentDiv.innerText = 'A apărut o eroare. Verifică dacă CID-ul este corect și nodul IPFS rulează.';
    }
});