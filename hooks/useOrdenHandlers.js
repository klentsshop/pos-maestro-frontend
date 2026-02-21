import { useState, useEffect } from 'react';

export function useOrdenHandlers({
    cart, total, clearCart, clearWithStockReturn, setCartFromOrden, 
    apiGuardar, apiEliminar, refreshOrdenes,
    ordenesActivas, esModoCajero, setMostrarCarritoMobile,
    nombreMesero, setNombreMesero,
    rep // Recibimos el hook de reportes para refrescar
}) {
    const [ordenActivaId, setOrdenActivaId] = useState(null);
    const [ordenMesa, setOrdenMesa] = useState(null);
    const [mensajeExito, setMensajeExito] = useState(false);

    // Texto dinámico para el componente visual
    const esVentaDirecta = esModoCajero && cart.length > 0 && !ordenActivaId;
    const textoBotonPrincipal = esVentaDirecta ? "GUARDAR" : (ordenActivaId ? "ACTUALIZAR" : "GUARDAR");

    // ✅ CORRECCIÓN: Autoselección de Caja por defecto
    useEffect(() => {
        if (esModoCajero && !nombreMesero) {
            setNombreMesero("Caja");
        }
    }, [esModoCajero, nombreMesero, setNombreMesero]);

    // ==============================
    // CARGAR ORDEN EXISTENTE
    // ==============================
    const cargarOrden = async (id) => {
        try {
            const res = await fetch('/api/ordenes/get', { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' }, 
                body: JSON.stringify({ ordenId: id }) 
            });
            const o = await res.json();
            if (o && o.platosOrdenados) {
                setOrdenActivaId(o._id); 
                setOrdenMesa(o.mesa); 
                setNombreMesero(o.mesero || (esModoCajero ? "Caja" : null)); 
                setCartFromOrden(o.platosOrdenados); 
                setMostrarCarritoMobile(true);
                return true;
            }
        } catch (e) { 
            console.error("Error carga:", e); 
        }
        return false;
    };

    // ==============================
    // GUARDAR ORDEN (MESA)
    // ==============================
    const guardarOrden = async (opciones = {}) => {
        // Validación de carrito vacío
        if (cart.length === 0) return;

        let mesaDefault = esModoCajero ? "Mostrador" : "Mesa 1";
        let mesa = ordenMesa || prompt("Mesa o Cliente:", mesaDefault);
        if (!mesa) return;

        // Escudo Anti-Duplicados
        if (!ordenActivaId) {
            const existe = ordenesActivas.find(
                (o) => o.mesa.toLowerCase() === mesa.trim().toLowerCase()
            );

            if (existe) {
                const deseaCargar = confirm(`La [${mesa}] ya tiene una orden activa. ¿Deseas cargarla para añadir más productos?`);
                if (deseaCargar) {
                    cargarOrden(existe._id); 
                    return; 
                } else {
                    alert("Operación cancelada. Para evitar duplicados, usa un nombre de mesa diferente.");
                    return; 
                }
            }
        }

        let meseroFinal = nombreMesero || localStorage.getItem('ultimoMesero') || (esModoCajero ? "Caja" : null);
        
        if (!meseroFinal) {
            alert("⚠️ Por favor, selecciona un mesero antes de guardar la orden.");
            return;
        }

        localStorage.setItem('ultimoMesero', meseroFinal);

        // Mapeo de platos con lógica de INVENTARIO preservada
        const platosParaGuardar = cart.map(i => ({ 
            _key: i._key || i.lineId || Math.random().toString(36).substring(2, 9), 
            nombrePlato: i.nombre, 
            cantidad: i.cantidad, 
            precioUnitario: i.precioNum, 
            subtotal: i.precioNum * i.cantidad,
            comentario: i.comentario || "",
            controlaInventario: i.controlaInventario || false,
            insumoVinculado: i.insumoVinculado || null,
            cantidadADescontar: i.cantidadADescontar || 0
        }));

        const currentOrdenId = ordenActivaId;

        try {
            if (typeof setMensajeExito === 'function') setMensajeExito(true);
            setMostrarCarritoMobile(false);

            await apiGuardar({ 
                mesa: mesa.trim(), 
                mesero: meseroFinal, 
                ordenId: currentOrdenId, 
                platosOrdenados: platosParaGuardar,
                imprimirSolicitada: true, 
                ultimaActualizacion: new Date().toISOString()
            });

            await refreshOrdenes();

            setTimeout(() => {
                if (typeof setMensajeExito === 'function') setMensajeExito(false);
                setOrdenActivaId(null); 
                setOrdenMesa(null); 
                clearCart(); 
                if (meseroFinal) setNombreMesero(meseroFinal);
            }, 1500);

        } catch (e) { 
            console.error("🔥 [ERROR_GUARDAR_ORDEN]:", e);
            if (typeof setMensajeExito === 'function') setMensajeExito(false);
            alert("❌ Error crítico: La conexión con Sanity falló."); 
        }
    };

    // ==============================
    // COBRAR ORDEN (VENTA DIRECTA)
    // ==============================
    const cobrarOrden = async (metodoPago) => {
        if (cart.length === 0) {
            alert("⚠️ El carrito está vacío.");
            return;
        }

        if (!esModoCajero) {
            alert("⚠️ Solo el cajero puede realizar cobros directos.");
            return;
        }

        if (!confirm(`💰 ¿Confirmar cobro por $${total.toLocaleString('es-CO')} en ${metodoPago}?`)) return;

        const subtotalVenta = cart.reduce((s, i) => s + (i.precioNum * i.cantidad), 0);
        const valorPropina = total - subtotalVenta;

        const fechaLocal = new Date(
            new Date().toLocaleString('en-US', { timeZone: 'America/Bogota' })
        ).toISOString();

        try {
            const res = await fetch('/api/ventas', { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' }, 
                body: JSON.stringify({ 
                    mesa: ordenMesa || "Mostrador", 
                    mesero: nombreMesero || "Caja", 
                    metodoPago: metodoPago,
                    totalPagado: Number(subtotalVenta),
                    propinaRecaudada: Number(valorPropina),
                    fechaLocal, 
                    ordenId: ordenActivaId || null, 
                    platosVendidosV2: cart.map(i => ({ 
                        nombrePlato: i.nombre || i.nombrePlato, 
                        cantidad: i.cantidad, 
                        precioUnitario: i.precioNum, 
                        subtotal: i.precioNum * i.cantidad,
                        comentario: i.comentario || "" 
                    })) 
                }) 
            });

            if (res.ok) {
                const ventaGuardada = await res.json();
                alert(`✅ Venta Exitosa.`);

                if (ventaGuardada?._id) {
                    const urlTicket = `/ticket/${ventaGuardada._id}?type=cliente&auto=true`;
                    window.open(urlTicket, 'ventana_impresion_unica', 'width=100,height=100');
                }

                setTimeout(async () => {
                    if (ordenActivaId) await apiEliminar(ordenActivaId);
                    clearCart(); 
                    setOrdenActivaId(null); 
                    setOrdenMesa(null); 
                    await refreshOrdenes();
                    if (rep?.cargarReporteAdmin) rep.cargarReporteAdmin();
                    if (rep?.generarCierreDia) rep.generarCierreDia();
                }, 1500);
            } else { 
                alert('❌ Error en servidor.'); 
            }
        } catch (e) { 
            alert('❌ Error en el pago.'); 
        }
    };

    // ==============================
    // CANCELAR ORDEN
    // ==============================
    const cancelarOrden = async () => {
        if (!ordenActivaId) return;
        if (!esModoCajero) return alert("🔒 PIN de Cajero requerido.");

        if (confirm(`⚠️ ¿Eliminar orden de ${ordenMesa}?`)) {
            try {
                await apiEliminar(ordenActivaId);
                await clearWithStockReturn(); 
                setOrdenActivaId(null); 
                setOrdenMesa(null);
                if (!esModoCajero) setNombreMesero(null);
                await refreshOrdenes(); 
                alert("🗑️ Eliminada.");
            } catch (error) { 
                alert("❌ Error."); 
            }
        }
    };

    return { 
        ordenActivaId, 
        ordenMesa, 
        cargarOrden, 
        guardarOrden, 
        cobrarOrden, 
        cancelarOrden,
        mensajeExito, 
        textoBotonPrincipal,
        setMensajeExito,
        setOrdenActivaId, 
        setOrdenMesa
    };
}