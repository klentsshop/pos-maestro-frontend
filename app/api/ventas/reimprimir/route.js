import { sanityClientServer } from '@/lib/sanity';

export async function POST(req) {
    try {
        const { venta } = await req.json();
        
        // 🧮 CALCULO DE SEGURIDAD PARA LA APK:
        // Aseguramos que el total que viaja al ticket incluya la propina
        const totalConPropina = Number(venta.totalPagado || 0) + Number(venta.propinaRecaudada || 0);

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
            // ✅ AHORA SÍ: Enviamos el valor sumado para que la APK no reste de más
            totalPagado: totalConPropina,
            propinaRecaudada: Number(venta.propinaRecaudada || 0),
            
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