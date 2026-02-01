import { NextResponse } from 'next/server';
import { sanityClientServer } from '@/lib/sanity';

export const dynamic = 'force-dynamic';

export async function POST(request) {
    try {
        const body = await request.json();
        const { fechaInicio, fechaFin, pinAdmin } = body; 

        // 🛡️ 1. VALIDACIÓN DE PRIVACIDAD
        const seguridad = await sanityClientServer.fetch(
            `*[_type == "seguridad"][0]{ pinAdmin }`,
            {}, 
            { useCdn: false }
        );

        const PIN_ADMIN_REAL = seguridad?.pinAdmin || process.env.PIN_ADMIN;

        if (!pinAdmin || pinAdmin !== PIN_ADMIN_REAL) {
            return NextResponse.json(
                { error: '⚠️ No autorizado. PIN administrativo incorrecto.' },
                { status: 401 }
            );
        }

        if (!fechaInicio || !fechaFin) {
            return NextResponse.json(
                { error: 'Faltan rangos de fecha' },
                { status: 400 }
            );
        }

        // 🕛 2. NORMALIZACIÓN DE FECHAS (CORTE REAL A MEDIANOCHE - COLOMBIA)
        // Esto soluciona el problema de los "ceros" al asegurar el rango completo del día
        const inicio = new Date(fechaInicio);
        inicio.setHours(0, 0, 0, 0); 

        const fin = new Date(fechaFin);
        fin.setHours(23, 59, 59, 999); 

        // 3. CONSULTA DE VENTAS (BLINDADA + COMPATIBLE CON TODO EL HISTORIAL)
        // Buscamos en 'fechaLocal' (nuevo), 'fecha' (antiguo) y '_createdAt' (respaldo)
        const queryVentas = `*[_type == "venta" && (
            (defined(fechaLocal) && fechaLocal >= $inicio && fechaLocal <= $fin) ||
            (!defined(fechaLocal) && fecha >= $inicio && fecha <= $fin) ||
            (_createdAt >= $inicio && _createdAt <= $fin)
        )]{
            "totalPagado": coalesce(totalPagado, 0),
            "propinaRecaudada": coalesce(propinaRecaudada, 0),
            mesero,
            metodoPago,
            platosVendidosV2,
            fecha,
            fechaLocal,
            _createdAt
        }`;

        // 4. CONSULTA DE GASTOS
        const queryGastos = `*[_type == "gasto" && (
            fecha >= $inicio && fecha <= $fin ||
            _createdAt >= $inicio && _createdAt <= $fin
        )]{
            "monto": coalesce(monto, 0),
            descripcion,
            fecha
        }`;

        const [ventas, gastos] = await Promise.all([
            sanityClientServer.fetch(queryVentas, { inicio, fin }, { useCdn: false }),
            sanityClientServer.fetch(queryGastos, { inicio, fin }, { useCdn: false })
        ]);

        // 📊 5. PROCESAMIENTO ESTRATÉGICO
        const metodosPago = { efectivo: 0, tarjeta: 0, digital: 0 };
        const rankingPlatos = {};
        const porMesero = {}; // Añadido para no romper la visualización por mesero
        let totalPropinas = 0;

        ventas?.forEach(v => {
            const ventaNeta = Number(v.totalPagado || 0);
            const propina = Number(v.propinaRecaudada || 0);

            totalPropinas += propina;

            // Procesamiento de Meseros
            const nombreM = v.mesero || "General";
            porMesero[nombreM] = (porMesero[nombreM] || 0) + ventaNeta;

            // Procesamiento de Métodos de Pago
            const metodo = (v.metodoPago || 'efectivo').toLowerCase();
            if (metodo.includes('tarjeta')) {
                metodosPago.tarjeta += ventaNeta;
            } else if (metodo.includes('nequi') || metodo.includes('daviplata') || metodo.includes('digital') || metodo.includes('transferencia')) {
                metodosPago.digital += ventaNeta;
            } else {
                metodosPago.efectivo += ventaNeta;
            }

            // Procesamiento de Ranking
            v.platosVendidosV2?.forEach(p => {
                const nombre = p.nombrePlato || "Desconocido";
                rankingPlatos[nombre] =
                    (rankingPlatos[nombre] || 0) + (Number(p.cantidad) || 0);
            });
        });

        const totalVentasSumadas = ventas?.reduce((acc, v) => acc + Number(v.totalPagado || 0), 0) || 0;
        const totalGastosSumados = gastos?.reduce((acc, g) => acc + Number(g.monto || 0), 0) || 0;

        return NextResponse.json({ 
            ventas: ventas || [], 
            gastos: gastos || [],
            ventasTotales: totalVentasSumadas,
            gastosTotales: totalGastosSumados,
            porMesero,
            estadisticas: {
                metodosPago,
                totalPropinas,
                topPlatos: Object.entries(rankingPlatos)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 5)
            }
        });

    } catch (error) {
        console.error('[REPORT_API_ERROR]:', error);
        return NextResponse.json(
            { error: error.message },
            { status: 500 }
        );
    }
}