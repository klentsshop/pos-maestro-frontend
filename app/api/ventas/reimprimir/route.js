import { sanityClientServer } from '@/lib/sanity';

export async function POST(req) {
    try {
        const { venta } = await req.json();
        
        // 🧮 AJUSTE PARA LA APK ACTUAL:
        // Como la APK ya suma la propina internamente, enviamos el neto
        // El Historial nos manda el total sumado, así que aquí restamos la propina.
        const valorPropina = Number(venta.propinaRecaudada || 0);
        const valorNetoComida = Number(venta.totalPagado || 0) - valorPropina;

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
            // ✅ ENVIAMOS EL NETO: La APK le sumará la propina automáticamente
            totalPagado: valorNetoComida,
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