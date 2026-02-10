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
            // 🧠 INTEGRACIÓN SENIOR: Mantenemos el spread de ordenPayload para no perder nada,
            // pero aseguramos que los disparadores de impresión viajen al servidor.
            const payload = {
                ...ordenPayload,
                estado: ordenPayload.estado || 'abierta',
                // ✅ Leemos los flags que vienen del hook useOrdenHandlers
                imprimirSolicitada: ordenPayload.imprimirSolicitada ?? false,
                imprimirCliente: ordenPayload.imprimirCliente ?? false,
                ultimaActualizacion: new Date().toISOString()
            };

            const res = await fetch('/api/ordenes/list', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            
            if (!res.ok) throw new Error("Error al guardar en servidor");
            
            const data = await res.json();
            
            // ✅ Optimistic UI: Refresca la lista global de inmediato.
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
        try {
            const res = await fetch('/api/ordenes/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ordenId }),
            });
            
            if (!res.ok) throw new Error("Error al eliminar");
            
            // Refrescar lista de mesas activas inmediatamente
            await mutate(); 
        } catch (error) {
            console.error("❌ Error al eliminar orden:", error);
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