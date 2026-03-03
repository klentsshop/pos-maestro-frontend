import { sanityClientServer } from '@/lib/sanity';

export async function POST(req) {
    try {
        const { venta } = await req.json();
        
        // 🧮 LÓGICA DE SUMA REAL (VALORES DE VISION):
        const valorPropina = Number(venta.propinaRecaudada || 0);
        const valorNetoComida = Number(venta.totalPagado || 0);
        const granTotalReal = valorNetoComida + valorPropina;

        const objetoTicket = {
            _type: 'ticketCobro', 
            mesa: `${venta.mesa}`,
            mesero: venta.mesero,
            metodoPago: venta.metodoPago || "Efectivo",
            platosOrdenados: (venta.platosVendidosV2 || []).map(p => ({
                _key: Math.random().toString(36).substring(2, 9),
                nombrePlato: p.nombrePlato,
                cantidad: p.cantidad,
                precio: p.precioUnitario,
                subtotal: p.subtotal,
            })),

            // 🎯 ETIQUETAS PARA LA APK (Pintará los datos de Vision):
            subtotal: valorNetoComida,   // Pintará el neto (ej: 65000)
            propina: valorPropina,       // Pintará la propina (ej: 6500)
            total: granTotalReal,        // Pintará la suma real (ej: 71500)

            // ✅ CAMPOS PARA SANITY:
            totalPagado: granTotalReal,
            propinaRecaudada: valorPropina,
            
            imprimirSolicitada: true, 
            imprimirCliente: true,    
            fecha: new Date().toISOString()
        };

        await sanityClientServer.create(objetoTicket);
        return Response.json({ ok: true });
    } catch (err) {
        console.error('[REIMPRESION_ERROR]:', err);
        return Response.json({ error: err.message }, { status: 500 });
    }
}