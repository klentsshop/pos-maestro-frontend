import { NextResponse } from 'next/server';
import { sanityClientServer } from '@/lib/sanity';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * LISTAR ÓRDENES ACTIVAS
 * Mantenemos la consulta limpia para el panel de mesas.
 */
export async function GET() {
    try {
        const query = `*[_type == "ordenActiva"] | order(fechaCreacion asc) {
            _id,
            mesa,
            mesero,
            fechaCreacion,
            platosOrdenados,
            imprimirSolicitada
        }`;

        const data = await sanityClientServer.fetch(query, {}, { useCdn: false });
        return NextResponse.json(data || []); 
    } catch (error) {
        console.error('[API_LIST_GET_ERROR]:', error);
        return NextResponse.json([], { status: 200 });
    }
}

/**
 * CREAR O ACTUALIZAR ORDEN
 * Optimizada para evitar duplicados y procesar solo la comanda de cocina.
 */
export async function POST(request) {
    try {
        const body = await request.json();
        const { mesa, mesero, platosOrdenados, ordenId } = body;

        if (!mesa || !Array.isArray(platosOrdenados) || platosOrdenados.length === 0) {
            return NextResponse.json(
                { error: 'Datos incompletos para procesar la orden.' },
                { status: 400 }
            );
        }

        // 1. Normalización de platos (Lógica de negocio intacta)
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
        
        // 🚀 LIMPIEZA: Solo mantenemos imprimirSolicitada (Cocina) que sí funciona bien.
        // El interruptor de Cliente se maneja ahora por el Historial de Ventas.
        const valorSolicitada = body.imprimirSolicitada === true;

        // 🛡️ ESCUDO ANTI-DUPLICADOS (Blindaje de ID y Mesa)
        let idDestino = ordenId;
        if (!idDestino) {
            const mesaPrevia = await sanityClientServer.fetch(
                `*[_type == "ordenActiva" && mesa == $mesa][0]._id`,
                { mesa },
                { useCdn: false }
            );
            if (mesaPrevia) idDestino = mesaPrevia;
        }

        if (idDestino) {
            // ACTUALIZAR (PATCH) - Evita crear mesas fantasmales
            try {
                const updated = await sanityClientServer
                    .patch(idDestino)
                    .set({
                        mesa,
                        mesero,
                        platosOrdenados: platosNormalizados,
                        ultimaActualizacion: fechaActual,
                        imprimirSolicitada: valorSolicitada,
                        // 🗑️ Eliminamos 'imprimirCliente' de aquí para evitar conflictos de escritura
                    })
                    .commit();

                return NextResponse.json({
                    message: 'Orden actualizada',
                    ordenId: updated._id
                });
            } catch (patchError) {
                console.warn('⚠️ Fallo en Patch, reintentando como creación.');
            }
        }

        // CREAR NUEVA (Solo si la mesa realmente no existe)
        const nuevaOrden = {
            _type: 'ordenActiva',
            mesa,
            mesero,
            fechaCreacion: fechaActual,
            ultimaActualizacion: fechaActual,
            platosOrdenados: platosNormalizados,
            imprimirSolicitada: valorSolicitada
        };

        const created = await sanityClientServer.create(nuevaOrden);

        return NextResponse.json(
            {
                message: 'Orden creada',
                ordenId: created._id
            },
            { status: 201 }
        );

    } catch (error) {
        console.error('🔥 [API_LIST_POST_ERROR]:', error);
        return NextResponse.json(
            { error: 'Error en servidor Sanity', details: error.message },
            { status: 500 }
        );
    }
}