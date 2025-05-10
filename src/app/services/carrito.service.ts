import { Injectable } from '@angular/core';
import { Producto } from '../models/producto';
import { ProductoService } from './producto.service';

@Injectable({
  providedIn: 'root'
})
export class CarritoService {
  private carrito: Producto[] = [];

  constructor(private productoService: ProductoService) {
    const storedCarrito = localStorage.getItem('carrito');
    if (storedCarrito) {
      this.carrito = JSON.parse(storedCarrito);
    }
  }

  agregarProducto(producto: Producto): void {
    const productoExistente = this.carrito.find(p => p.id === producto.id);
    if (productoExistente) {
      productoExistente.cantidad += 1;
    } else {
      this.carrito.push({ ...producto, cantidad: 1 });
    }
    this.productoService.disminuirCantidad(producto.id).subscribe({
      next: () => this.guardarCarrito(),
      error: (err) => console.error('Error al disminuir cantidad:', err)
    });
    console.log('Carrito actual:', this.carrito);
  }

  obtenerCarrito(): Producto[] {
    return this.carrito;
  }

  eliminarProducto(id: number): void {
    const producto = this.carrito.find(p => p.id === id);
    if (producto) {
      this.productoService.aumentarCantidad(id, producto.cantidad).subscribe({
        next: () => {
          this.carrito = this.carrito.filter(p => p.id !== id);
          this.guardarCarrito();
        },
        error: (err) => console.error('Error al aumentar cantidad:', err)
      });
    }
  }

  actualizarCarrito(carrito: Producto[]): void {
    this.carrito = carrito;
    this.guardarCarrito();
  }

  limpiarCarrito(): void {
    this.carrito = [];
    this.guardarCarrito();
  }

  descargaXML(): void {
    try {
      let subtotal = 0;
      this.carrito.forEach((producto) => {
        const precio = Number(producto.precio);
        if (isNaN(precio) || precio <= 0) {
          throw new Error(`Precio inválido para ${producto.nombre}`);
        }
        subtotal += precio * producto.cantidad;
      });
      const iva = subtotal * 0.16;
      const total = subtotal + iva;

      let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
      xml += `<cfdi:Comprobante Version="4.0" xmlns:cfdi="http://www.sat.gob.mx/cfd/4" `;
      xml += `xmlns:tfd="http://www.sat.gob.mx/TimbreFiscalDigital" `;
      xml += `xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" `;
      xml += `xsi:schemaLocation="http://www.sat.gob.mx/cfd/4 http://www.sat.gob.mx/cfd/4/cfdv40.xsd" `;
      xml += `Serie="A" Folio="12345" Fecha="${new Date().toISOString()}" FormaPago="01" Moneda="MXN" `;
      xml += `SubTotal="${subtotal.toFixed(2)}" Descuento="0 resultant.00" Total="${total.toFixed(2)}" `;
      xml += `TipoDeComprobante="I" MetodoPago="PUE" LugarExpedicion="99999">\n`;

      xml += `  <cfdi:Emisor Rfc="EMIS123456789" Nombre="Emisor SA de CV" RegimenFiscal="601"/>\n`;
      xml += `  <cfdi:Receptor Rfc="RECEP987654321" Nombre="Receptor SA de CV" UsoCFDI="G03"/>\n`;
      xml += `  <cfdi:Conceptos>\n`;
      this.carrito.forEach((producto) => {
        const precio = Number(producto.precio);
        if (isNaN(precio) || precio <= 0) {
          throw new Error(`Precio inválido para ${producto.nombre}`);
        }
        xml += `    <cfdi:Concepto ClaveProdServ="10101504" Cantidad="${producto.cantidad}" ClaveUnidad="H87" `;
        xml += `Descripcion="${producto.nombre || 'Producto sin nombre'}" `;
        xml += `ValorUnitario="${precio.toFixed(2)}" Importe="${(precio * producto.cantidad).toFixed(2)}">\n`;
        xml += `      <cfdi:Impuestos>\n`;
        xml += `        <cfdi:Traslados>\n`;
        xml += `          <cfdi:Traslado Base="${(precio * producto.cantidad).toFixed(2)}" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="${(precio * producto.cantidad * 0.16).toFixed(2)}"/>\n`;
        xml += `        </cfdi:Traslados>\n`;
        xml += `      </cfdi:Impuestos>\n`;
        xml += `    </cfdi:Concepto>\n`;
      });
      xml += `  </cfdi:Conceptos>\n`;
      xml += `  <cfdi:Impuestos TotalImpuestosTrasladados="${iva.toFixed(2)}">\n`;
      xml += `    <cfdi:Traslados>\n`;
      xml += `      <cfdi:Traslado Base="${subtotal.toFixed(2)}" Impuesto="002" TipoFactor="Tasa" TasaOCuota="0.160000" Importe="${iva.toFixed(2)}"/>\n`;
      xml += `    </cfdi:Traslados>\n`;
      xml += `  </cfdi:Impuestos>\n`;
      xml += `</cfdi:Comprobante>\n`;

      const blob = new Blob([xml], { type: 'application/xml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'carrito_cfdi.xml';
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error generando XML:', err);
      throw err;
    }
  }

  private guardarCarrito(): void {
    localStorage.setItem('carrito', JSON.stringify(this.carrito));
  }
}