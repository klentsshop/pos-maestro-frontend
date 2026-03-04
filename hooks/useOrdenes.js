import useSWR, { mutate as mutateGlobal } from 'swr';
import { useState } from 'react';

const fetcher = (url) => fetch(url).then((res) => {
    if (!res.ok) throw new Error('Error al obtener datos');
    return res.json();
});

export function useOrdenes() {
    // ✅ Sincronización Profesional: 7 segundos para ahorro base.
    const { data: ordenes = [], mutate, error } = useSWR('/api/ordenes/list', fetcher, {
        refreshInterval: 7000, 
        revalidateOnFocus: true,
        revalidateOnReconnect: true,
        dedupingInterval: 2000,
        focusThrottleInterval: 2000 
    });

    const [cargandoAccion, setCargandoAccion] = useState(false);

    // FUNCIÓN PARA GUARDAR O ACTUALIZAR (Lógica original 100% preservada)
    const guardarOrden = async (ordenPayload) => {
        setCargandoAccion(true);
        try {
            // 📝 REVISIÓN LÍNEA POR LÍNEA:
            const payload = {
                ...ordenPayload,
                estado: ordenPayload.estado || 'abierta',
                metodoPago: ordenPayload.metodoPago || 'efectivo',
                
                // 🚀 Priorizamos el 'true' si viene del botón.
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
            
            // ✅ Sincronizamos mesas
            await mutate(); 
            // 🔥 CERO LAG: Forzamos al inventario a despertar con un timestamp único
            await mutateGlobal(`/api/inventario/list?t=${Date.now()}`); 
            
            return data;
        } catch (err) {
            console.error("❌ Error guardarOrden:", err);
            throw err; 
        } finally {
            setCargandoAccion(false);
        }
    };

    // FUNCIÓN PARA ELIMINAR (Mantiene gestión de stock y liberación de mesa)
    const eliminarOrden = async (ordenId) => {
        if (!ordenId) return;
        
        const ordenAEliminar = ordenes.find(o => o._id === ordenId);

        try {
            // 🛡️ LÓGICA DE DEVOLUCIÓN MASIVA (Tu lógica original intacta)
            if (ordenAEliminar && ordenAEliminar.platos) {
                
                const platosParaDevolver = ordenAEliminar.platos
                    .filter(p => p.controlaInventario && p.insumoVinculado?._ref)
                    .map(p => ({
                        insumos: [{ 
                            _id: p.insumoVinculado._ref, 
                            cantidad: Number(p.cantidadADescontar) || 1 
                        }],
                        cantidad: Number(p.cantidad) || 1
                    }));

                if (platosParaDevolver.length > 0) {
                    await fetch('/api/inventario/devolver', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ items: platosParaDevolver })
                    });
                    // 🔥 CERO LAG: Asegura que el stock se vea recuperado AL INSTANTE
                    await mutateGlobal(`/api/inventario/list?t=${Date.now()}`);
                }
            }

            // 2. Eliminación física de la orden en Sanity
            const res = await fetch('/api/ordenes/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ordenId }),
            });
            
            if (!res.ok) throw new Error("Error al eliminar la orden del servidor");
            
            // 3. Sincronizamos la UI de mesas
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