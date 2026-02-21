import { NextResponse } from 'next/server';
import { sanityClientServer } from '@/lib/sanity';

export const dynamic = 'force-dynamic';

export async function POST(request) {
    try {
        const body = await request.json();
        const { fechaSeleccionada } = body; 

        if (!fechaSeleccionada) {
            return NextResponse.json({ error: 'Falta la fecha' }, { status: 400 });
        }

        // 🕛 NORMALIZACIÓN IDÉNTICA A TU API ADMIN (Corte Colombia)
        // Esto asegura que si buscas "hoy", tome desde las 00:00 hasta las 23:59
        const inicio = `${fechaSeleccionada} 00:00:00`;
        const fin = `${fechaSeleccionada} 23:59:59`;

        // CONSULTA BLINDADA (Copia fiel de tu lógica de reporte)
        const query = `*[_type == "venta" && (
            (defined(fechaLocal) && fechaLocal >= $inicio && fechaLocal <= $fin) ||
            (!defined(fechaLocal) && fecha >= $inicio && fecha <= $fin) ||
            (_createdAt >= $inicio && _createdAt <= $fin)
        )] | order(fechaLocal desc) {
            _id,
            folio,
            mesa,
            mesero,
            metodoPago,
            totalPagado,
            propinaRecaudada,
            fechaLocal,
            platosVendidosV2
        }`;

        const ventas = await sanityClientServer.fetch(query, { inicio, fin }, { useCdn: false });

        return NextResponse.json(ventas || []);
    } catch (error) {
        console.error('[HISTORIAL_VENTAS_ERROR]:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}