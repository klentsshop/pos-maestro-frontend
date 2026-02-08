// app/hooks/useOrdenHandlers.js
import { useState } from 'react';
import { sendToPOSBridge } from '@/lib/posBridge';
import { SITE_CONFIG } from '@/lib/config';


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
    // 1. Validaciones iniciales críticas (Sin cambios)
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

    // 3. 👤 Manejo de Mesero y Persistencia (Sin cambios)
    let meseroFinal = nombreMesero || localStorage.getItem('ultimoMesero') || (esModoCajero ? "Caja" : null);
    if (!meseroFinal) return alert("⚠️ Seleccione mesero antes de guardar.");

    localStorage.setItem('ultimoMesero', meseroFinal);

    // --- ⚡ ESTRATEGIA DE VELOCIDAD CON FEEDBACK EN BARRA ---
    
    // Guardamos copia del carrito antes de cualquier limpieza
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
        // A. Activamos el mensaje de éxito en la barra ANTES de limpiar el carrito
        if (typeof setMensajeExito === 'function') setMensajeExito(true);
        
        // B. Cerramos el panel del carrito para que el mesero vea el menú
        setMostrarCarritoMobile(false);

        // C. Ejecutamos el guardado en segundo plano
        await apiGuardar({ 
            mesa, 
            mesero: meseroFinal, 
            ordenId: currentOrdenId, 
            platosOrdenados: platosParaGuardar 
        });

        // D. Refrescamos mesas silenciosamente
        await refreshOrdenes();

        // E. ⏳ TEMPORIZADOR DE 2 SEGUNDOS:
        // Mantener el carrito lleno 2 seg permite que la barra de Rappi 
        // muestre el mensaje de éxito antes de desaparecer.
        setTimeout(() => {
            if (typeof setMensajeExito === 'function') setMensajeExito(false);
            setOrdenActivaId(null); 
            setOrdenMesa(null); 
            clearCart(); // Aquí es donde la barra finalmente se oculta
            if (meseroFinal) setNombreMesero(meseroFinal);
        }, 2000);

        console.log(`✅ Orden ${mesa} guardada exitosamente.`);

    } catch (e) { 
        // Si falla, apagamos el mensaje de éxito y avisamos
        if (typeof setMensajeExito === 'function') setMensajeExito(false);
        console.error("Error en Sanity:", e);
        alert("❌ Error crítico: La orden no se guardó. Revisa tu conexión a internet."); 
    }
   };
    const cobrarOrden = async (metodoPago) => {
    if (cart.length === 0 || !esModoCajero) return;
    if (!confirm(`💰 ¿Cobrar $${total.toLocaleString('es-CO')}?`)) return;

    // 🧠 Lógica de desglosado
    const subtotalVenta = cart.reduce(
        (s, i) => s + (i.precioNum * i.cantidad), 
        0
    );
    const valorPropina = total - subtotalVenta;

    // 🕒 FECHA LOCAL REAL (COLOMBIA)
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
                totalPagado: Number(subtotalVenta), // Venta real
                propinaRecaudada: Number(valorPropina), // Propina pura
                fechaLocal, // 👈🔥 CAMPO CLAVE PARA REPORTES
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
            if (ordenActivaId) await apiEliminar(ordenActivaId);

            alert(`✅ Venta Exitosa.`);

            clearCart(); 
            setOrdenActivaId(null); 
            setOrdenMesa(null); 

            await refreshOrdenes();

            // 🔥 Refresco automático de reportes
            if (rep?.cargarReporteAdmin) rep.cargarReporteAdmin();
            if (rep?.generarCierreDia) rep.generarCierreDia();

            // 🖨️🔌 Notificar a POS Bridge (APK / Hardware)
            if (SITE_CONFIG?.pos?.usaAPK) {
                sendToPOSBridge('VENTA_CERRADA', {
                    mesa: ordenMesa || 'Mostrador',
                    metodoPago,
                    total,
                    abrirCajon: SITE_CONFIG.pos.usaCajon && metodoPago === 'efectivo'
                });
            }

        } else { 
            alert('❌ Error en servidor.'); 
        }

    } catch (e) { 
        alert('❌ Error en el pago.'); 
    }
};


    const imprimirClienteManual = async () => {
    if (!cart || cart.length === 0) {
        alert('⚠️ No hay productos para imprimir');
        return;
    }

    try {
        const subtotal = cart.reduce(
            (acc, i) => acc + (i.precioNum * i.cantidad),
            0
        );

        const propina = total - subtotal;

        const payload = {
            mesa: ordenMesa || 'Mostrador',
            mesero: nombreMesero || 'Caja',
            items: cart.map(i => ({
                nombrePlato: i.nombre,
                cantidad: i.cantidad,
                precioUnitario: i.precioNum,
                subtotal: i.precioNum * i.cantidad
            })),
            subtotal,
            propina,
            total
        };

        const res = await fetch('/api/ticket-cliente', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!res.ok) {
            throw new Error('No se pudo enviar el ticket a impresión');
        }

        alert('🖨️ Ticket enviado a impresión');

    } catch (error) {
        console.error('❌ Error impresión cliente:', error);
        alert('❌ Error al imprimir ticket');
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
         imprimirClienteManual,
        cancelarOrden,
        mensajeExito,  
        setMensajeExito,
        setOrdenActivaId, 
        setOrdenMesa
    };
}
