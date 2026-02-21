import useSWR from 'swr';

const fetcher = async (url) => {
    // Añadimos un timestamp para que el navegador no guarde la respuesta en caché
    const res = await fetch(`${url}?t=${Date.now()}`); 
    if (!res.ok) throw new Error('Error al cargar datos');
    return res.json();
};

export function useInventario() {
    const { data, error, mutate, isLoading } = useSWR('/api/inventario/list', fetcher, {
        refreshInterval: 5000,       // Bajamos a 5 segundos para más precisión
        revalidateOnFocus: true,     
        revalidateOnMount: true,     
        dedupingInterval: 0,
        revalidateIfStale: true      // ✅ OBLIGA a revalidar aunque crea que tiene datos frescos
    });

    const cargarStock = async (insumoId, cantidad) => {
        try {
            const res = await fetch('/api/inventario/update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ insumoId, cantidadASumar: Number(cantidad) })
            });
            
            if (res.ok) {
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