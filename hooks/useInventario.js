import useSWR from 'swr';

const fetcher = async (url) => {
    // ✅ CAMBIO CLAVE: Quitamos la URL estática para que acepte el timestamp dinámico
    // Esto es lo que permite que el inventario se actualice en 1 segundo y no en 17.
    const res = await fetch(url); 
    if (!res.ok) throw new Error('Error al cargar datos');
    return res.json();
};

export function useInventario() {
    const { data, error, mutate, isLoading } = useSWR('/api/inventario/list', fetcher, {
        refreshInterval: 30000,      // 30 segundos: Ahorro masivo de requests
        revalidateOnFocus: true,     // Actualiza al tocar la pantalla
        revalidateOnMount: true,     
        dedupingInterval: 2000,      // Evita clics accidentales
        revalidateIfStale: true      
    });

    const cargarStock = async (insumoId, cantidad) => {
        try {
            const res = await fetch('/api/inventario/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ insumoId, cantidadASumar: Number(cantidad) })
            });
            
            if (res.ok) {
                // Forzamos actualización local inmediata tras el cambio exitoso
                await mutate(); 
                return true;
            }
            return false;
        } catch (err) {
            console.error("Error actualizando stock:", err);
            return false;
        }
    };

    return { 
        insumos: data || [], 
        cargarStock,
        cargando: isLoading,
        mutate, 
        error
    };
}