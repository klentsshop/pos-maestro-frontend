import { NextResponse } from 'next/server'
import { sanityClientServer } from '@/lib/sanity'
import crypto from 'crypto'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function POST(req) {
  try {
    const payload = await req.json()

    const mesa = payload.mesa || 'General'
    const mesero = payload.mesero || 'Caja'
    const items = payload.items || []
    const subtotal = Number(payload.subtotal) || 0
    const propina = Number(payload.propina) || 0
    const total = Number(payload.total) || 0

    if (items.length === 0) {
      return NextResponse.json(
        { ok: false, error: 'No hay items para imprimir' },
        { status: 400 }
      )
    }

    const fecha = new Date().toISOString()

    // ============================
    // DOCUMENTO SOLO PARA HARDWARE
    // ============================
    const ticketCobro = {
      _type: 'ticketCobro',
      mesa,
      mesero,
      items: items.map(i => ({
        _key: crypto.randomUUID(),
        nombrePlato: i.nombrePlato,
        cantidad: Number(i.cantidad) || 1,
        precio: Number(i.precioUnitario) || 0,
        subtotal: Number(i.subtotal) || 0
      })),
      subtotal,
      propina,
      total,
      abrirCajon: false,        // 👈 NUNCA ABRE CAJÓN
      imprimirCliente: true,    // 👈 IMPRESIÓN MANUAL
      impreso: false,
      fecha
    }

    await sanityClientServer.create(ticketCobro)

    return NextResponse.json(
      { ok: true, message: 'Ticket enviado a impresión manual' },
      { status: 201 }
    )

  } catch (err) {
    console.error('🔥 [ERROR_TICKET_CLIENTE]:', err)
    return NextResponse.json(
      { ok: false, error: 'Error creando ticket de impresión', details: err.message },
      { status: 500 }
    )
  }
}
