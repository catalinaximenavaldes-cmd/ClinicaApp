// url.js
const CONFIG = {
    // Pega aquí la URL de tu implementación de Apps Script
    API_URL: "https://script.google.com/macros/s/AKfycbz8-7LojRxxVZdPjS8CnpV6U99udBDKZbNqNbsnHKCAA4SbVDRAmwE9EU7CCoK1TwDV/exec",

    // Puedes agregar más configuraciones aquí si las necesitas en el futuro
    VERSION: "1.0.1"
};

// Congelamos el objeto para que no pueda ser modificado accidentalmente por otros scripts
Object.freeze(CONFIG);