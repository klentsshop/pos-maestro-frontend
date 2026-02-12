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

   const guardarOrden = async (opciones = {}) => {
    // 1. 🛡️ Validaciones iniciales críticas
    if (cart.length === 0) return;

    let mesaDefault = esModoCajero ? "Mostrador" : "Mesa 1";
    let mesa = ordenMesa || prompt("Mesa o Cliente:", mesaDefault);
    if (!mesa) return;

    // 2. 🛡️ Escudo Anti-Duplicados (Protección de Integridad)
    // Solo si es una orden nueva (no tenemos ordenActivaId), verificamos que la mesa no esté ocupada
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

    // 3. 👤 Manejo de Mesero y Persistencia
    let meseroFinal = nombreMesero || localStorage.getItem('ultimoMesero') || (esModoCajero ? "Caja" : null);
    
    if (!meseroFinal) {
        alert("⚠️ Por favor, selecciona un mesero antes de guardar la orden.");
        return;
    }

    // Guardamos el mesero para que no tenga que elegirlo en la siguiente mesa
    localStorage.setItem('ultimoMesero', meseroFinal);

    // 4. ⚡ Preparación de Datos Normalizados
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
        // Interfaz: Mostramos carga y cerramos carrito en móvil
        if (typeof setMensajeExito === 'function') setMensajeExito(true);
        setMostrarCarritoMobile(false);

        // 🚀 ENVÍO A API (Limpieza de interruptor de cliente)
        await apiGuardar({ 
            mesa: mesa.trim(), 
            mesero: meseroFinal, 
            ordenId: currentOrdenId, 
            platosOrdenados: platosParaGuardar,
            // ✅ Mantenemos Cocina: Esto hace que la comanda salga en la APK de cocina
            imprimirSolicitada: true, 
            // 🗑️ LIMPIEZA: Eliminamos la lógica de opciones.imprimirCliente
            // Ya no enviamos este switch aquí para evitar bloqueos de documento.
            ultimaActualizacion: new Date().toISOString()
        });

        // 🛡️ REFUERZO ANTI-DUPLICIDAD: Refrescamos Sanity inmediatamente
        await refreshOrdenes();

        // ⏳ Finalización de la operación
        setTimeout(() => {
            if (typeof setMensajeExito === 'function') setMensajeExito(false);
            
            // Limpiamos los estados locales para quedar listos para la siguiente orden
            setOrdenActivaId(null); 
            setOrdenMesa(null); 
            clearCart(); 
            
            // Mantenemos el mesero visualmente si fue seleccionado
            if (meseroFinal) setNombreMesero(meseroFinal);
        }, 1500); // Reducido a 1.5s para mayor agilidad

    } catch (e) { 
        console.error("🔥 [ERROR_GUARDAR_ORDEN]:", e);
        if (typeof setMensajeExito === 'function') setMensajeExito(false);
        alert("❌ Error crítico: La conexión con Sanity falló. La orden NO se guardó."); 
    }
};
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
    };

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
        cancelarOrden,
        mensajeExito,  
        setMensajeExito,
        setOrdenActivaId, 
        setOrdenMesa
    };
}