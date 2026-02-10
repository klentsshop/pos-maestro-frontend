import { NextResponse } from 'next/server';
import { sanityClientServer } from '@/lib/sanity';

export const dynamic = 'force-dynamic';

export async function POST(req) {
    try {
        const body = await req.json();
        // 1. Desestructuración completa de los campos necesarios para la APK y el POS
        const { 
            mesa, 
            mesero, 
            platosOrdenados, 
            ordenId, 
            imprimirSolicitada, 
            imprimirCliente 
        } = body;

        // 🧠 MAPEO DE SEGURIDAD: Mantenemos la lógica original de transformación de platos
        const platosParaSanity = platosOrdenados.map(p => ({
            _key: p.lineId || p._key || Math.random().toString(36).substring(2, 11),
            _type: 'platoOrdenado', 
            nombrePlato: p.nombre || p.nombrePlato,
            cantidad: Number(p.cantidad) || 1,
            precioUnitario: Number(p.precioNum || p.precioUnitario || 0),
            subtotal: Number(p.subtotalNum || p.subtotal || 0),
            comentario: p.comentario || "" 
        }));

        // Definimos la fecha actual una sola vez para consistencia
        const ahora = new Date().toISOString();

        // 🏗️ ESTRUCTURA DEL DOCUMENTO: Incluimos los nuevos campos del esquema
        const doc = {
            _type: 'ordenActiva',
            mesa: mesa || 'Mesa Sin Nombre',
            mesero: mesero || 'Mesero',
            platosOrdenados: platosParaSanity,
            fechaCreacion: ahora,
            ultimaActualizacion: ahora,
            // Flags de impresión (disparadores para la APK)
            imprimirSolicitada: imprimirSolicitada ?? false,
            imprimirCliente: imprimirCliente ?? false
        };

        let resultado;
        if (ordenId) {
            // 🔄 ACTUALIZACIÓN (PATCH): Para mesas que ya están abiertas
            resultado = await sanityClientServer
                .patch(ordenId)
                .set({
                    mesa: doc.mesa,
                    mesero: doc.mesero,
                    platosOrdenados: doc.platosOrdenados,
                    ultimaActualizacion: ahora,
                    // Encendemos los interruptores si el frontend lo solicita
                    imprimirSolicitada: imprimirSolicitada ?? false,
                    imprimirCliente: imprimirCliente ?? false
                })
                .commit();
        } else {
            // ✨ CREACIÓN (CREATE): Para nuevas órdenes o clientes de mostrador
            resultado = await sanityClientServer.create(doc);
        }

        return NextResponse.json(resultado, { status: 201 });

    } catch (err) {
        console.error('🔥 [API_ORDENES_ERROR]:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}