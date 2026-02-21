import useSWR from 'swr';
import { useState } from 'react';

const fetcher = (url) => fetch(url).then((res) => {
    if (!res.ok) throw new Error('Error al obtener datos');
    return res.json();
});

export function useOrdenes() {
    // ✅ Sincronización Real-Time: SWR consulta al servidor cada 5 segundos.
    const { data: ordenes = [], mutate, error } = useSWR('/api/ordenes/list', fetcher, {
        refreshInterval: 5000, 
        revalidateOnFocus: true,
        revalidateOnReconnect: true
    });

    const [cargandoAccion, setCargandoAccion] = useState(false);

    // FUNCIÓN PARA GUARDAR O ACTUALIZAR
    const guardarOrden = async (ordenPayload) => {
        setCargandoAccion(true);
        try {
            // 📝 REVISIÓN LÍNEA POR LÍNEA:
            const payload = {
                ...ordenPayload,
                estado: ordenPayload.estado || 'abierta',
                
                // 🚀 AJUSTE CLAVE: Priorizamos el 'true' si viene del botón.
                // Si ordenPayload.imprimirCliente es true, se queda true.
                imprimirSolicitada: ordenPayload.imprimirSolicitada === true ? true : (ordenPayload.imprimirSolicitada ?? false),
                imprimirCliente: ordenPayload.imprimirCliente === true ? true : (ordenPayload.imprimirCliente ?? false),
                
                ultimaActualizacion: new Date().toISOString()
            };

            const res = await fetch('/api/ordenes/list', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            
            if (!res.ok) throw new Error("Error al guardar en servidor");
            
            const data = await res.json();
            
            // ✅ AJUSTE SENIOR: 
            // Cambiamos mutate(undefined) por un mutate() asíncrono.
            // Esto evita que las mesas "desaparezcan" de golpe, recuperando la fluidez antigua,
            // pero forzando a SWR a validar los nuevos datos de Sanity inmediatamente.
            await mutate(); 
            
            return data;
        } catch (err) {
            console.error("❌ Error guardarOrden:", err);
            throw err; 
        } finally {
            setCargandoAccion(false);
        }
    };

    // FUNCIÓN PARA ELIMINAR (Tras Cobro o Cancelación)
   const eliminarOrden = async (ordenId) => {
    if (!ordenId) return;
    
    // 1. Buscamos la orden en el estado local de SWR
    const ordenAEliminar = ordenes.find(o => o._id === ordenId);

    try {
        // 🛡️ LÓGICA DE DEVOLUCIÓN MASIVA
        if (ordenAEliminar && ordenAEliminar.platos) {
            
            // Mapeamos los platos al formato que espera la API
            const platosParaDevolver = ordenAEliminar.platos
                .filter(p => p.controlaInventario && p.insumoVinculado?._ref)
                .map(p => ({
                    insumos: [{ 
                        _id: p.insumoVinculado._ref, 
                        // Cantidad que usa el plato (ej: 0.5 o 1)
                        cantidad: Number(p.cantidadADescontar) || 1 
                    }],
                    // Cantidad de platos que había en la mesa (ej: 3 gaseosas)
                    cantidad: Number(p.cantidad) || 1
                }));

            // 🚀 Enviamos todo el bloque de una sola vez
            if (platosParaDevolver.length > 0) {
                await fetch('/api/inventario/devolver', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        items: platosParaDevolver 
                    })
                });
            }
        }

        // 2. Eliminación física de la orden en Sanity
        const res = await fetch('/api/ordenes/delete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ordenId }),
        });
        
        if (!res.ok) throw new Error("Error al eliminar la orden del servidor");
        
        // 3. Sincronizamos la UI
        await mutate(); 
        console.log("✅ Mesa borrada y stock recuperado.");

    } catch (error) {
        console.error("❌ Error en eliminarOrden:", error);
        alert("Hubo un error al intentar borrar la mesa.");
    }
};

    return {
        ordenes,
        guardarOrden,
        eliminarOrden,
        refresh: mutate, 
        cargandoAccion,
        errorConexion: error
    };
}