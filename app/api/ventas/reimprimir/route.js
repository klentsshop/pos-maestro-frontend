// app/api/ventas/reimprimir/route.js
import { sanityClientServer } from '@/lib/sanity';

export async function POST(req) {
    try {
        const { venta } = await req.json();
        
        const objetoTicket = {
            _type: 'ticketCobro', // Asegúrate que la APK busque este tipo
            mesa: `${venta.mesa}`,
            mesero: venta.mesero,
            metodoPago: venta.metodoPago || "Efectivo",
            // 🚀 IMPORTANTE: Usamos 'platosOrdenados' o 'items' según lo que la APK espere
            platosOrdenados: (venta.platosVendidosV2 || []).map(p => ({
                _key: Math.random().toString(36).substring(2, 9),
                nombrePlato: p.nombrePlato,
                cantidad: p.cantidad,
                precio: p.precioUnitario,
                subtotal: p.subtotal,
            })),
            totalPagado: Number(venta.totalPagado),
            propinaRecaudada: Number(venta.propinaRecaudada || 0),
            // 🎯 LOS DISPARADORES PARA LA APK
            imprimirSolicitada: true, // 👈 INDISPENSABLE para que el Watcher lo atrape
            imprimirCliente: true,    // 👈 Para que use el clienteRenderer
            fecha: new Date().toISOString()
        };

        await sanityClientServer.create(objetoTicket);
        return Response.json({ ok: true });
    } catch (err) {
        return Response.json({ error: err.message }, { status: 500 });
    }
}