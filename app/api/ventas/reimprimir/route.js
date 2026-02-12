// app/api/ventas/reimprimir/route.js
import { sanityClientServer } from '@/lib/sanity';

export async function POST(req) {
    try {
        const { venta } = await req.json();
        
        const objetoTicket = {
            _type: 'ticketCobro',
            mesa: `COPIA: ${venta.mesa}`,
            mesero: venta.mesero,
            items: (venta.platosVendidosV2 || []).map(p => ({
                _key: Math.random().toString(36).substring(2, 9),
                nombrePlato: p.nombrePlato,
                cantidad: p.cantidad,
                precio: p.precioUnitario,
                subtotal: p.subtotal
            })),
            subtotal: Number(venta.totalPagado),
            propina: Number(venta.propinaRecaudada || 0),
            total: Number(venta.totalPagado) + Number(venta.propinaRecaudada || 0),
            imprimirCliente: true, // Forzamos la impresión
            impreso: false,
            fecha: new Date().toISOString()
        };

        await sanityClientServer.create(objetoTicket);
        return Response.json({ ok: true });
    } catch (err) {
        return Response.json({ error: err.message }, { status: 500 });
    }
}