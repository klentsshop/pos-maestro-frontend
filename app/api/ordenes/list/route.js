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
 * Incluye motor de popularidad inteligente para ranking en el POS.
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

        // 1. Normalización de platos (Lógica de negocio e inventario intacta)
        const platosNormalizados = platosOrdenados.map(p => {
            const cantidad = Number(p.cantidad) || 1;
            const precio = Number(p.precioUnitario || p.precioNum) || 0; 

            return {
                _key: p._key || p.lineId || Math.random().toString(36).substring(2, 9), 
                _id: p._id, // Preservamos el ID para referencia
                nombrePlato: p.nombrePlato || p.nombre, 
                cantidad,
                precioUnitario: precio,
                subtotal: precio * cantidad,
                comentario: p.comentario || "",
                controlaInventario: p.controlaInventario || false,
                cantidadADescontar: p.cantidadADescontar || 0,
                insumoVinculado: p.insumoVinculado || null
            };
        });

        const fechaActual = new Date().toISOString();
        
        // 🚀 LIMPIEZA: Solo mantenemos imprimirSolicitada (Cocina)
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

        let responseData;

        if (idDestino) {
            // ACTUALIZAR (PATCH) - Evita crear mesas fantasmales
            const updated = await sanityClientServer
                .patch(idDestino)
                .set({
                    mesa,
                    mesero,
                    platosOrdenados: platosNormalizados,
                    ultimaActualizacion: fechaActual,
                    imprimirSolicitada: valorSolicitada,
                })
                .commit();

            responseData = {
                message: 'Orden actualizada',
                ordenId: updated._id
            };
        } else {
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

            responseData = {
                message: 'Orden creada',
                ordenId: created._id
            };
        }

        // 🔥 🚀 MOTOR DE POPULARIDAD (Orden Inteligente)
        // Ejecutamos esto de forma asíncrona al final para NO bloquear el retorno al mesero
        try {
            const promesasPopularidad = platosOrdenados.map(p => {
                const platoId = p._id || p.id || p.platoId;

                // 🛡️ Si no hay ID, saltamos este plato sin romper la ejecución
                if (!platoId) return Promise.resolve();

                return sanityClientServer
                    .patch(platoId)
                    .setIfMissing({ totalVentas: 0 })
                    .inc({ totalVentas: Number(p.cantidad) || 1 })
                    .commit()
                    .catch(e => console.error("Error en patch de popularidad individual:", e.message));
            });
            
            // Disparamos las promesas sin 'await' para que el mesero reciba su respuesta YA
            Promise.allSettled(promesasPopularidad);

        } catch (errPop) {
            // Error en popularidad no debe afectar el éxito del pedido
            console.error('❌ [POPULARIDAD_SILENCIOSA]:', errPop.message);
        }

        // Retornamos el éxito de la operación principal (Guardar Mesa)
        return NextResponse.json(responseData, { status: idDestino ? 200 : 201 });

    } catch (error) {
        console.error('🔥 [API_LIST_POST_ERROR]:', error);
        return NextResponse.json(
            { error: 'Error en servidor Sanity', details: error.message },
            { status: 500 }
        );
    }
}