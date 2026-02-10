// app/hooks/useOrdenHandlers.js
import { useState } from 'react';

export function useOrdenHandlers({
    cart, total, clearCart, setCartFromOrden, 
    apiGuardar, apiEliminar, refreshOrdenes,
    ordenesActivas, esModoCajero, setMostrarCarritoMobile,
    nombreMesero, setNombreMesero,
    rep // 👈 Recibimos el hook de reportes para refrescar
}) {
    const [ordenActivaId, setOrdenActivaId] = useState(null);
    const [ordenMesa, setOrdenMesa] = useState(null);
    const [mensajeExito, setMensajeExito] = useState(false);

    const cargarOrden = async (id) => {
        try {
            const res = await fetch('/api/ordenes/get', { 
                method: 'POST', headers: { 'Content-Type': 'application/json' }, 
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
        } catch(e) { 
            console.error("Error carga:", e); 
        }
        return false;
    };

    const guardarOrden = async () => {
        // 1. Validaciones iniciales críticas
        if (cart.length === 0) return;

        let mesaDefault = esModoCajero ? "Mostrador" : "Mesa 1";
        let mesa = ordenMesa || prompt("Mesa o Cliente:", mesaDefault);
        if (!mesa) return;

        // 2. 🛡️ Validación de Duplicados (Protección de Integridad)
        if (!ordenActivaId) {
            const existe = ordenesActivas.find(
                (o) => o.mesa.toLowerCase() === mesa.toLowerCase()
            );

            if (existe) {
                const deseaCargar = confirm(`La [${mesa}] tiene orden activa. ¿Cargarla?`);
                if (deseaCargar) {
                    cargarOrden(existe._id); 
                    return; 
                } else {
                    alert("Operación cancelada. No se puede crear otra orden con el mismo nombre.");
                    return; 
                }
            }
        }

        // 3. 👤 Manejo de Mesero y Persistencia
        let meseroFinal = nombreMesero || localStorage.getItem('ultimoMesero') || (esModoCajero ? "Caja" : null);
        if (!meseroFinal) return alert("⚠️ Seleccione mesero antes de guardar.");

        localStorage.setItem('ultimoMesero', meseroFinal);

        // --- ⚡ ESTRATEGIA DE VELOCIDAD Y PREPARACIÓN DE DATOS ---
        const platosParaGuardar = cart.map(i => ({ 
            _key: i._key || i.lineId || Math.random().toString(36).substring(2, 9), 
            nombrePlato: i.nombre, 
            cantidad: i.cantidad, 
            precioUnitario: i.precioNum, 
            subtotal: i.precioNum * i.cantidad,
            comentario: i.comentario || "" 
        }));

        const currentOrdenId = ordenActivaId;

        try {
            if (typeof setMensajeExito === 'function') setMensajeExito(true);
            setMostrarCarritoMobile(false);

            await apiGuardar({ 
                mesa, 
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
            }, 2000);

        } catch (e) { 
            if (typeof setMensajeExito === 'function') setMensajeExito(false);
            console.error("Error en Sanity:", e);
            alert("❌ Error crítico: La orden no se guardó."); 
        }
    }; // ✅ Cierre agregado

    const cobrarOrden = async (metodoPago) => {
        if (cart.length === 0 || !esModoCajero) return;
        if (!confirm(`💰 ¿Cobrar $${total.toLocaleString('es-CO')}?`)) return;

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
                    metodoPago, 
                    totalPagado: Number(subtotalVenta),
                    propinaRecaudada: Number(valorPropina),
                    fechaLocal, 
                    ordenId: ordenActivaId || null, 
                    platosVendidosV2: cart.map(i => ({ 
                        nombrePlato: i.nombre, 
                        cantidad: i.cantidad, 
                        precioUnitario: i.precioNum, 
                        subtotal: i.precioNum * i.cantidad,
                        comentario: i.comentario || "" 
                    })) 
                }) 
            });

            if (res.ok) {
                alert(`✅ Venta Exitosa.`);
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
    }; // ✅ Cierre agregado

    const imprimirClienteManual = async () => {
        if (!cart || cart.length === 0) {
            alert('⚠️ No hay productos');
            return;
        }
        try {
            await apiGuardar({
                mesa: ordenMesa,
                ordenId: ordenActivaId,
                platosOrdenados: cart.map(i => ({ 
                    _key: i._key || Math.random().toString(36).substring(2, 9),
                    nombrePlato: i.nombre, 
                    cantidad: i.cantidad, 
                    precioUnitario: i.precioNum 
                })),
                imprimirSolicitada: true,
                imprimirCliente: true, 
                ultimaActualizacion: new Date().toISOString()
            });
            alert('🖨️ Enviando ticket a la cola...');
        } catch (error) {
            alert('❌ Error al solicitar impresión.');
        }
    }; // ✅ Cierre agregado

    const cancelarOrden = async () => {
        if (!ordenActivaId) return;
        if (!esModoCajero) return alert("🔒 PIN de Cajero requerido.");

        if (confirm(`⚠️ ¿Eliminar orden de ${ordenMesa}?`)) {
            try {
                await apiEliminar(ordenActivaId);
                clearCart(); 
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
        imprimirClienteManual,
        cancelarOrden,
        mensajeExito,  
        setMensajeExito,
        setOrdenActivaId, 
        setOrdenMesa
    };
}