import { NextResponse } from 'next/server';
import { sanityClientServer } from '@/lib/sanity';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * LISTAR ÓRDENES ACTIVAS
 * Modificado para traer los platos y que el cajero vea el contenido
 */
export async function GET() {
    try {
        const query = `*[_type == "ordenActiva"] | order(fechaCreacion asc) {
            _id,
            mesa,
            mesero,
            fechaCreacion,
            platosOrdenados // ✅ CRÍTICO: Si no traemos esto, el cajero ve la mesa pero no los platos
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
 */
export async function POST(request) {
    try {
        const body = await request.json();
        const { mesa, mesero, platosOrdenados, ordenId } = body;

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

        // OBJETO BASE PARA CREACIÓN (Se usa como fallback si el patch falla)
        const nuevaOrden = {
            _type: 'ordenActiva',
            mesa,
            mesero,
            fechaCreacion: new Date().toISOString(),
            platosOrdenados: platosNormalizados
        };

        // --- LÓGICA DE ACTUALIZACIÓN CON FALLBACK ---
        if (ordenId) {
            try {
                const updated = await sanityClientServer
                    .patch(ordenId)
                    .set({
                        mesa,
                        mesero,
                        platosOrdenados: platosNormalizados,
                        ultimaActualizacion: new Date().toISOString()
                    })
                    .commit();

                return NextResponse.json({
                    message: 'Orden actualizada correctamente',
                    ordenId: updated._id,
                    mesa: updated.mesa,
                    mesero: updated.mesero
                });
            } catch (patchError) {
                // Si el ID no existe o fue borrado, no lanzamos 500. 
                // Simplemente ignoramos el error y dejamos que el código siga para crear una nueva.
                console.warn('⚠️ ID de orden no encontrado para patch, procediendo a crear nueva.');
            }
        }

        // --- CREAR NUEVA (Si no hay ordenId o si el patch falló) ---
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