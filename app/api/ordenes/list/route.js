import { NextResponse } from 'next/server';
import { sanityClientServer } from '@/lib/sanity';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * LISTAR ÓRDENES ACTIVAS
 * Mantenemos la lógica intacta para que el cajero vea los platos.
 */
export async function GET() {
    try {
        const query = `*[_type == "ordenActiva"] | order(fechaCreacion asc) {
            _id,
            mesa,
            mesero,
            fechaCreacion,
            platosOrdenados,
            imprimirSolicitada,
            imprimirCliente
        }`;

        const data = await sanityClientServer.fetch(query);
        return NextResponse.json(data || []); 
    } catch (error) {
        console.error('[API_LIST_GET_ERROR]:', error);
        return NextResponse.json([], { status: 200 });
    }
}

/**
 * CREAR O ACTUALIZAR ORDEN
 * Integración total con la lógica de impresión para la APK.
 */
export async function POST(request) {
    try {
        const body = await request.json();
        // 1. Extraemos los nuevos campos (imprimirSolicitada, imprimirCliente)
        const { mesa, mesero, platosOrdenados, ordenId, imprimirSolicitada, imprimirCliente } = body;

        if (!mesa || !Array.isArray(platosOrdenados) || platosOrdenados.length === 0) {
            return NextResponse.json(
                { error: 'Datos incompletos para crear/actualizar la orden.' },
                { status: 400 }
            );
        }

        const platosNormalizados = platosOrdenados.map(p => {
            const cantidad = Number(p.cantidad) || 1;
            const precio = Number(p.precioUnitario || p.precioNum) || 0; 

            return {
                _key: p._key || p.lineId || Math.random().toString(36).substring(2, 9), 
                nombrePlato: p.nombrePlato || p.nombre, 
                cantidad,
                precioUnitario: precio,
                subtotal: precio * cantidad,
                comentario: p.comentario || ""
            };
        });

        const fechaActual = new Date().toISOString();

        // OBJETO BASE PARA CREACIÓN (Incluye flags de impresión)
        const nuevaOrden = {
            _type: 'ordenActiva',
            mesa,
            mesero,
            fechaCreacion: fechaActual,
            ultimaActualizacion: fechaActual,
            platosOrdenados: platosNormalizados,
            imprimirSolicitada: imprimirSolicitada ?? false,
            imprimirCliente: imprimirCliente ?? false
        };

        // --- LÓGICA DE ACTUALIZACIÓN CON PATCH ---
        if (ordenId) {
            try {
                const updated = await sanityClientServer
                    .patch(ordenId)
                    .set({
                        mesa,
                        mesero,
                        platosOrdenados: platosNormalizados,
                        ultimaActualizacion: fechaActual,
                        // ✅ DISPARADORES APK: Ahora sí viajan a Sanity
                        imprimirSolicitada: imprimirSolicitada ?? false,
                        imprimirCliente: imprimirCliente ?? false
                    })
                    .commit();

                return NextResponse.json({
                    message: 'Orden actualizada correctamente',
                    ordenId: updated._id,
                    mesa: updated.mesa,
                    mesero: updated.mesero
                });
            } catch (patchError) {
                console.warn('⚠️ ID de orden no encontrado para patch, procediendo a crear nueva.');
            }
        }

        // --- CREAR NUEVA ---
        const created = await sanityClientServer.create(nuevaOrden);

        return NextResponse.json(
            {
                message: 'Orden creada correctamente',
                ordenId: created._id,
                mesa: created.mesa,
                mesero: created.mesero
            },
            { status: 201 }
        );

    } catch (error) {
        console.error('🔥 [API_LIST_POST_ERROR]:', error);
        return NextResponse.json(
            { error: 'Error al procesar orden en Sanity', details: error.message },
            { status: 500 }
        );
    }
}