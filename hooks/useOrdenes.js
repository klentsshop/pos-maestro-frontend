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
        try {
            const res = await fetch('/api/ordenes/delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ordenId }),
            });
            
            if (!res.ok) throw new Error("Error al eliminar");
            
            // Refrescar lista de mesas activas inmediatamente sin borrar el estado local
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