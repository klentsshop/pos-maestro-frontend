import { NextResponse } from 'next/server';
import { sanityClientServer } from '@/lib/sanity';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(req) {
    try {
        const payload = await req.json();
        
        const mesa = payload.mesa || 'General';
        const mesero = payload.mesero || 'Personal General';
        const metodoPago = payload.metodoPago || 'efectivo';
        const totalPagado = Number(payload.totalPagado) || 0;
        const propinaRecaudada = Number(payload.propinaRecaudada) || 0;
        const ordenId = payload.ordenId;

        // ============================
        // FECHAS (UTC + LOCAL COLOMBIA)
        // ============================
        const now = new Date();
        const fechaUTC = now.toISOString();
        const fechaLocal = new Date().toLocaleString('sv-SE', {
            timeZone: 'America/Bogota'
        });

        // --- FOLIO PROFESIONAL ---
        const datePart = fechaUTC.slice(2, 10).replace(/-/g, '');
        const randomPart = crypto.randomBytes(2).toString('hex').toUpperCase();
        const folioGenerado = `TAL-${datePart}-${randomPart}`;

        // --- MAPEO DE PLATOS VENDIDOS ---
        const platosVenta = (payload.platosVendidosV2 || []).map(item => ({
            _key: crypto.randomUUID(),
            _type: 'platoVendidoV2',
            nombrePlato: item.nombrePlato,
            cantidad: Number(item.cantidad) || 1,
            precioUnitario: Number(item.precioUnitario) || 0,
            subtotal: Number(item.subtotal) || 0,
            comentario: item.comentario || ""
        }));

        // ============================
        // REGLAS DE HARDWARE (CAJÓN / TICKET)
        // ============================
        const abrirCajon = metodoPago === 'efectivo';
        const imprimirCliente = false; // impresión manual desde botón

        // ============================
        // OBJETO VENTA (NO SE TOCA)
        // ============================
        const objetoVenta = {
            _type: 'venta',
            folio: folioGenerado,
            mesa: mesa,
            mesero: mesero,
            metodoPago: metodoPago,
            totalPagado: totalPagado,
            propinaRecaudada: propinaRecaudada,
            fecha: fechaUTC,
            fechaLocal: fechaLocal,
            platosVendidosV2: platosVenta,
        };

        // ============================
        // OBJETO TICKET PARA APK
        // ============================
        const objetoTicketCobro = {
            _type: 'ticketCobro',
            mesa: mesa,
            mesero: mesero,
            items: platosVenta.map(p => ({
                _key: crypto.randomUUID(),
                nombrePlato: p.nombrePlato,
                cantidad: p.cantidad,
                precio: p.precioUnitario,
                subtotal: p.subtotal
            })),
            subtotal: totalPagado,
            propina: propinaRecaudada,
            total: totalPagado + propinaRecaudada,
            abrirCajon: abrirCajon,
            imprimirCliente: imprimirCliente,
            impreso: false,
            fecha: fechaUTC
        };

        // ============================
        // TRANSACCIÓN ATÓMICA
        // ============================
        let transaction = sanityClientServer
            .transaction()
            .create(objetoVenta)
            .create(objetoTicketCobro);

        if (ordenId) {
            transaction = transaction.delete(ordenId);
        }

        await transaction.commit();

        return NextResponse.json({ 
            ok: true, 
            message: 'Venta registrada, hardware notificado y mesa liberada',
            folio: folioGenerado
        }, { status: 201 });

    } catch (err) {
        console.error('🔥 [FATAL_ERROR_VENTAS]:', err);
        return NextResponse.json({ 
            ok: false, 
            error: 'Error en la transacción',
            details: err.message 
        }, { status: 500 });
    }
}
