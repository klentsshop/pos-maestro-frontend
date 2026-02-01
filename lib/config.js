// lib/config.js
export const SYSTEM = {
    name: "Pedidos Pro POS",
    version: "1.0.0",
    buildDate: "2026-01-04",
    developer: "Klentsshop"
};
export const SITE_CONFIG = {
    // 👤 IDENTIDAD DEL NEGOCIO
    brand: {
        name: "Chicharrón al Fogón",
        shortName: "Chicharrón al Fogón",
        nit: "123.456.789-0",
        address: "Cll. 191 #8b-05, Bogotá",
        phone: "3103086336",
        mensajeTicket: "¡Gracias por su compra!",
        currency: "es-CO",
        symbol: "$",
    },

    // 🎨 PALETA DE COLORES (SaaS Ready)
    theme: {
        primary: "#10B981",    // Verde (Cajeros, Cobrar, Éxito)
        secondary: "#166534",  // Azul (Imprimir Cliente, Info)
        accent: "#F59E0B",     // Naranja (Gastos, Advertencias)
        danger: "#EF4444",     // Rojo (Reportes, Borrar)
        dark: "#166534",       // Gris Oscuro (Cabeceras, Cocina)
        textLight: "#FFFFFF",
        textDark: "#4B5563",
    },

    // 🏷️ CATEGORÍAS PERSONALIZABLES (Tus 12 categorías originales)
    categorias: {
        todos: '🏠 TODO',
        carta: '🥩 Carta',
        picadas: '🥘 Picadas',
        bebidas: '🥤 Bebidas',
        sopas: '🍲 Sopas',
        desayunos: '☕ Desayuno',
        diario: '🍛 Diario',
        Porciones: '🥟 Porciones',
        Tipicos: '🍱 tipicos',
        Adiciones: '🍟 Adiciones',
        otros: '⚙️ Otros'
    },

    // 💳 MÉTODOS DE PAGO
    metodosPago: [
        { title: '💵 Efectivo', value: 'efectivo' },
        { title: '📱 Digital', value: 'digital' },
        { title: '💳 Tarjeta', value: 'tarjeta' }
    ],

    // ⚙️ LÓGICA DE OPERACIÓN
    logic: {
        timezone: 'America/Bogota',
        // Categoría que siempre va al final del ticket
        drinkCategory: "bebidas",
        // Palabras que disparan prioridad alta en cocina
        priorityKeywords: ["almuerzo", "especial", "corriente", "sopa"],
        // PIN por defecto si no hay en Sanity
        defaultAdminPin: "1234",
    },
    // 🖨️🔌 INTEGRACIÓN POS / APK (OPCIONAL)
    pos: {
        usaAPK: true,      // Cliente 1: usa APK de impresión
        usaCajon: true     // Cliente 1: tiene cajón monedero
    }
};